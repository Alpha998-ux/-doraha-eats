/**
 * Doraha Eats — full acceptance test.
 * Runs the exact 27-step flow against a RUNNING server and a SEEDED database.
 *
 *   npm run seed && npm run dev      (in one terminal)
 *   node tests/acceptance.mjs        (in another)
 */
const BASE = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const PASS = process.env.DEMO_PASSWORD ?? 'Doraha@123';

let passed = 0, failed = 0;
const rupees = (p) => `Rs ${(p / 100).toFixed(2)}`;

function ok(label, detail = '') {
  passed++; console.log(`  PASS  ${label}${detail ? `  — ${detail}` : ''}`);
}
function bad(label, detail = '') {
  failed++; console.log(`  FAIL  ${label}${detail ? `  — ${detail}` : ''}`);
}
function assert(cond, label, detail = '') {
  cond ? ok(label, detail) : bad(label, detail);
  return cond;
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, body: json };
}

const login = async (email) => {
  const r = await api('/auth/login', { method: 'POST', body: { email, password: PASS } });
  if (r.status !== 200) throw new Error(`login ${email} failed: ${JSON.stringify(r.body)}`);
  return r.body.token;
};

async function run() {
  console.log('\n=== Doraha Eats — acceptance test ===\n');

  /* 1-6: infra already up (server + migrations + seed) */
  const health = await fetch(`${BASE.replace('/api/v1', '')}/health`).then((r) => r.json());
  assert(health.ok, 'Backend is running');

  const config = await api('/config');
  assert(config.status === 200 && config.body.serviceArea.length > 0,
    'Config loads with active service area',
    `${config.body.brand.name} — ${config.body.serviceArea.length} active zone(s)`);

  /* 7. Login as demo customer */
  const customerToken = await login('customer@dorahaeats.local');
  const meC = await api('/auth/me', { token: customerToken });
  assert(meC.body.user.role === 'CUSTOMER', 'Step 7: Logged in as demo customer', meC.body.user.fullName);

  /* 8. Select a Doraha delivery location (and prove out-of-zone is blocked) */
  const zone = config.body.serviceArea[0];
  const inside = await api('/location/resolve', {
    method: 'POST', body: { latitude: zone.latitude + 0.001, longitude: zone.longitude + 0.001 },
  });
  assert(inside.body.serviceable === true, 'Step 8: Doraha location is serviceable', inside.body.zone.name);

  const outside = await api('/location/resolve', {
    method: 'POST', body: { latitude: 28.6139, longitude: 77.2090 }, // New Delhi
  });
  assert(
    outside.body.serviceable === false &&
    outside.body.message === 'Delivery is currently unavailable at this location.',
    'Out-of-zone location is correctly refused', outside.body.message,
  );

  const addrList = await api('/addresses', { token: customerToken });
  const address = addrList.body.addresses.find((a) => a.zoneId) ?? addrList.body.addresses[0];
  assert(!!address?.zoneId, 'Customer has a serviceable saved address', address?.area);

  /* 9. Browse vendors */
  const vendorList = await api(`/vendors?zoneId=${address.zoneId}`);
  assert(vendorList.body.vendors.length > 0, 'Step 9: Vendor list returned for the zone',
    `${vendorList.body.vendors.length} stalls`);

  /* Search really hits the DB */
  const search = await api(`/search?q=momos&zoneId=${address.zoneId}`);
  assert(search.body.items.length > 0, 'Search "momos" returns real DB results',
    `${search.body.items.length} items, ${search.body.vendors.length} stalls`);

  /* 10. Open a vendor */
  const openVendor = vendorList.body.vendors.find((v) => v.isOpen) ?? vendorList.body.vendors[0];
  const vendorPage = await api(`/vendors/${openVendor.slug}`);
  assert(vendorPage.status === 200 && vendorPage.body.menu.length > 0,
    'Step 10: Vendor page and menu load', `${openVendor.name}`);

  /* 11. Add food to cart (with a customization) */
  await api('/cart', { method: 'DELETE', token: customerToken });
  const section = vendorPage.body.menu[0];
  const item = section.foodItems[0];
  const group = item.customizationGroups?.[0];
  const optionIds = group ? [group.options[0].id] : [];

  const add1 = await api('/cart/items', {
    method: 'POST', token: customerToken,
    body: { foodItemId: item.id, quantity: 2, optionIds, instructions: 'Less spicy please' },
  });
  assert(add1.status === 201 && add1.body.cart.items.length === 1,
    'Step 11: Item added to cart', `${item.name} x2`);

  const cartItemId = add1.body.cart.items[0].id;
  const upd = await api(`/cart/items/${cartItemId}`, {
    method: 'PATCH', token: customerToken, body: { quantity: 3 },
  });
  assert(upd.body.cart.items[0].quantity === 3, 'Cart quantity change works', 'qty 2 -> 3');

  const item2 = section.foodItems[1] ?? item;
  if (item2.id !== item.id) {
    await api('/cart/items', { method: 'POST', token: customerToken, body: { foodItemId: item2.id, quantity: 1 } });
  }

  /* Single-vendor cart guard */
  const otherVendor = vendorList.body.vendors.find((v) => v.id !== openVendor.id);
  if (otherVendor) {
    const otherPage = await api(`/vendors/${otherVendor.slug}`);
    const otherItem = otherPage.body.menu[0]?.foodItems[0];
    if (otherItem) {
      const cross = await api('/cart/items', {
        method: 'POST', token: customerToken, body: { foodItemId: otherItem.id, quantity: 1 },
      });
      assert(cross.status === 409 && cross.body.error.code === 'DIFFERENT_VENDOR',
        'Cart rejects items from a second stall', cross.body.error.code);
    }
  }

  /* 12. Checkout — backend computes every rupee */
  let quote = await api('/cart/quote', {
    method: 'POST', token: customerToken, body: { addressId: address.id },
  });

  // The zone enforces a minimum order. Prove the blocker fires, then clear it.
  if (quote.body.blockers.some((x) => x.code === 'BELOW_MINIMUM')) {
    ok('Minimum-order rule blocks an under-value cart',
       `${rupees(quote.body.breakdown.subtotalPaise)} < ${rupees(quote.body.breakdown.minOrderPaise)}`);
    const unit = quote.body.cart.items[0].unitPricePaise;
    const need = Math.ceil(quote.body.breakdown.minOrderPaise / unit) + 1;
    await api(`/cart/items/${quote.body.cart.items[0].id}`, {
      method: 'PATCH', token: customerToken, body: { quantity: Math.min(need, 50) },
    });
    quote = await api('/cart/quote', {
      method: 'POST', token: customerToken, body: { addressId: address.id },
    });
  }
  const b = quote.body.breakdown;
  const expectedTotal = b.subtotalPaise - b.discountPaise + b.deliveryFeePaise + b.platformFeePaise + b.taxPaise;
  assert(quote.body.canPlaceOrder, 'Step 12: Checkout quote has no blockers',
    `${rupees(b.subtotalPaise)} + fees = ${rupees(b.totalPaise)}`);
  assert(b.totalPaise === expectedTotal, 'Server-side total arithmetic is consistent',
    `${rupees(b.totalPaise)}`);

  /* 13. Place COD order */
  const placed = await api('/orders', {
    method: 'POST', token: customerToken,
    body: { addressId: address.id, paymentMethod: 'COD', cookingNote: 'Ring the bell twice' },
  });
  assert(placed.status === 201 && placed.body.order.status === 'PLACED',
    'Step 13: COD order created in PostgreSQL', placed.body.order?.code);
  const orderId = placed.body.order.id;
  const orderCode = placed.body.order.code;

  const cartAfter = await api('/cart', { token: customerToken });
  assert(cartAfter.body.cart.items.length === 0, 'Cart is emptied after placing the order');

  /* 14. Login as vendor */
  const vendorOwnerEmail = openVendor.slug === 'demo-sharma-burger-corner'
    ? 'vendor@dorahaeats.local'
    : `vendor${vendorList.body.vendors.findIndex((v) => v.id === openVendor.id) + 1}@dorahaeats.local`;

  // Find the right vendor account by checking which one owns this order.
  let vendorToken = null;
  for (const email of [vendorOwnerEmail, ...Array.from({ length: 10 }, (_, i) => i === 0 ? 'vendor@dorahaeats.local' : `vendor${i + 1}@dorahaeats.local`)]) {
    try {
      const t = await login(email);
      const check = await api(`/vendor/orders/${orderId}`, { token: t });
      if (check.status === 200) { vendorToken = t; break; }
    } catch { /* try next */ }
  }
  assert(!!vendorToken, 'Step 14: Logged in as the vendor who owns this order');

  const vendorQueue = await api('/vendor/orders?status=PLACED', { token: vendorToken });
  assert(vendorQueue.body.orders.some((o) => o.id === orderId),
    'Vendor sees the new order in their queue', `${vendorQueue.body.orders.length} placed order(s)`);

  /* 15. Accept order */
  const accepted = await api(`/vendor/orders/${orderId}/accept`, {
    method: 'POST', token: vendorToken, body: { prepTimeMinutes: 20 },
  });
  assert(accepted.body.order.status === 'ACCEPTED', 'Step 15: Vendor accepted the order');

  /* Invalid transition must be refused */
  const illegal = await api(`/delivery/${orderId}/accept`, { method: 'POST', token: await login('delivery@dorahaeats.local') });
  assert(illegal.status >= 400, 'Rider cannot claim an order that is not READY', illegal.body?.error?.code);

  /* 16. PREPARING */
  const preparing = await api(`/vendor/orders/${orderId}/preparing`, { method: 'POST', token: vendorToken });
  assert(preparing.body.order.status === 'PREPARING', 'Step 16: Order moved to PREPARING');

  /* 17. READY */
  const ready = await api(`/vendor/orders/${orderId}/ready`, { method: 'POST', token: vendorToken });
  assert(ready.body.order.status === 'READY', 'Step 17: Order moved to READY');

  /* 18. Login as delivery partner */
  const riderToken = await login('delivery@dorahaeats.local');
  const meD = await api('/auth/me', { token: riderToken });
  assert(meD.body.user.role === 'DELIVERY', 'Step 18: Logged in as delivery partner', meD.body.user.fullName);

  await api('/delivery/status', { method: 'PATCH', token: riderToken, body: { isOnline: true } });
  await api('/delivery/location', {
    method: 'POST', token: riderToken, body: { latitude: zone.latitude, longitude: zone.longitude },
  });

  const available = await api('/delivery/available', { token: riderToken });
  assert(available.body.deliveries.some((d) => d.orderId === orderId),
    'Ready order appears in the rider job list', `${available.body.deliveries.length} job(s)`);

  /* 19. Accept delivery */
  const claimed = await api(`/delivery/${orderId}/accept`, { method: 'POST', token: riderToken });
  assert(claimed.body.order.status === 'ASSIGNED', 'Step 19: Delivery partner accepted the delivery');

  /* Second rider must not be able to steal it */
  const rider2 = await login('delivery2@dorahaeats.local');
  await api('/delivery/status', { method: 'PATCH', token: rider2, body: { isOnline: true } });
  const steal = await api(`/delivery/${orderId}/accept`, { method: 'POST', token: rider2 });
  assert(steal.status >= 400, 'A second rider cannot claim the same delivery', steal.body?.error?.code);

  /* 20-22. PICKED_UP -> ON_THE_WAY -> DELIVERED */
  const pickedUp = await api(`/delivery/${orderId}/status`, {
    method: 'PATCH', token: riderToken, body: { status: 'PICKED_UP' },
  });
  assert(pickedUp.body.order.status === 'PICKED_UP', 'Step 20: Marked PICKED_UP');

  const onWay = await api(`/delivery/${orderId}/status`, {
    method: 'PATCH', token: riderToken, body: { status: 'ON_THE_WAY' },
  });
  assert(onWay.body.order.status === 'ON_THE_WAY', 'Step 21: Marked ON_THE_WAY');

  const delivered = await api(`/delivery/${orderId}/status`, {
    method: 'PATCH', token: riderToken,
    body: { status: 'DELIVERED', codCollectedPaise: placed.body.order.totalPaise },
  });
  assert(delivered.body.order.status === 'DELIVERED', 'Step 22: Marked DELIVERED');
  assert(delivered.body.order.paymentStatus === 'PAID', 'COD payment auto-settled on delivery');

  /* 23-24. Customer sees DELIVERED */
  const customerOrder = await api(`/orders/${orderId}`, { token: customerToken });
  assert(customerOrder.body.order.status === 'DELIVERED',
    'Steps 23-24: Customer sees the order as DELIVERED', orderCode);
  assert(customerOrder.body.order.events.length >= 7,
    'Full status timeline recorded', `${customerOrder.body.order.events.length} events`);

  const notifs = await api('/notifications', { token: customerToken });
  assert(notifs.body.notifications.length > 0,
    'Customer received in-app notifications', `${notifs.body.notifications.length} notifications`);

  /* 25. Submit review */
  const review = await api(`/orders/${orderId}/review`, {
    method: 'POST', token: customerToken,
    body: { rating: 5, deliveryRating: 5, comment: 'Acceptance test review — arrived hot.' },
  });
  assert(review.status === 201, 'Step 25: Review submitted');

  const dupe = await api(`/orders/${orderId}/review`, {
    method: 'POST', token: customerToken, body: { rating: 1 },
  });
  assert(dupe.status === 409, 'Duplicate review is rejected', dupe.body?.error?.code);

  /* 26-27. Admin sees everything */
  const adminToken = await login('admin@dorahaeats.local');
  const adminOrders = await api('/admin/orders', { token: adminToken });
  assert(adminOrders.body.orders.some((o) => o.id === orderId), 'Step 26-27: Admin sees the order');

  const adminVendors = await api('/admin/vendors', { token: adminToken });
  assert(adminVendors.body.vendors.length >= 10, 'Admin sees vendors', `${adminVendors.body.vendors.length}`);

  const adminCustomers = await api('/admin/customers', { token: adminToken });
  assert(adminCustomers.body.customers.length >= 5, 'Admin sees customers', `${adminCustomers.body.customers.length}`);

  const adminReviews = await api('/admin/reviews', { token: adminToken });
  assert(adminReviews.body.reviews.some((r) => r.orderId === orderId), 'Admin sees the new review');

  const analytics = await api('/admin/analytics', { token: adminToken });
  assert(analytics.body.cards.totalOrders > 0, 'Admin analytics computed',
    `${analytics.body.cards.totalOrders} orders, revenue ${rupees(analytics.body.cards.revenuePaise)}`);

  /* Security spot-checks */
  const noAuth = await api('/orders');
  assert(noAuth.status === 401, 'Protected route rejects an unauthenticated request');

  const wrongRole = await api('/admin/analytics', { token: customerToken });
  assert(wrongRole.status === 403, 'Customer token is refused on an admin route');

  const otherOrder = await api(`/orders/${orderId}`, { token: await login('customer2@dorahaeats.local') });
  assert(otherOrder.status === 403, 'A customer cannot read another customer\'s order');

  const badLogin = await api('/auth/login', {
    method: 'POST', body: { email: 'customer@dorahaeats.local', password: 'wrong-password' },
  });
  assert(badLogin.status === 401, 'Wrong password is rejected');

  /* Admin-configurable business rules actually take effect */
  const before = await api('/cart/quote', { method: 'POST', token: customerToken, body: { addressId: address.id } })
    .catch(() => null);
  await api('/admin/settings', { method: 'PUT', token: adminToken, body: { platformFeePaise: 900 } });
  await api('/cart/items', { method: 'POST', token: customerToken, body: { foodItemId: item.id, quantity: 1 } });
  const afterQuote = await api('/cart/quote', { method: 'POST', token: customerToken, body: { addressId: address.id } });
  assert(afterQuote.body.breakdown.platformFeePaise === 900,
    'Admin fee change flows straight into checkout pricing', rupees(900));
  await api('/admin/settings', { method: 'PUT', token: adminToken, body: { platformFeePaise: 500 } });
  await api('/cart', { method: 'DELETE', token: customerToken });

  /* Zone activation gate */
  const zones = await api('/admin/zones', { token: adminToken });
  const inactive = zones.body.zones.find((z) => !z.isActive);
  if (inactive) {
    const test = await api('/admin/zones/test', {
      method: 'POST', token: adminToken,
      body: { latitude: inactive.latitude, longitude: inactive.longitude },
    });
    assert(test.body.serviceable === false,
      'Inactive expansion zone is not serviceable until an admin activates it', inactive.name);
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('\nAcceptance run crashed:', e.message);
  process.exit(1);
});

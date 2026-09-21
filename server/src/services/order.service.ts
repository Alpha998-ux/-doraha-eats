import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  orders, orderItems, orderItemOptions, orderStatusEvents, payments, addresses,
  vendors, users, deliveryAssignments, deliveryPartners, reviews,
} from '../db/schema.js';
import { Errors } from '../lib/errors.js';
import { generateOrderCode } from '../lib/orderCode.js';
import { getPaymentProvider } from '../adapters/payments/index.js';
import { quoteCart, clearCart } from './cart.service.js';
import { getSettings } from './settings.service.js';
import { notify, ORDER_NOTIFICATIONS } from './notification.service.js';
import {
  actorCanSet, canTransition, STATUS_LABEL, type Actor, type OrderStatus,
} from './orderStatus.js';

export async function placeOrder(userId: string, input: {
  addressId: string;
  paymentMethod: 'COD' | 'UPI';
  cookingNote?: string;
}) {
  const [address] = await db
    .select().from(addresses)
    .where(and(eq(addresses.id, input.addressId), eq(addresses.userId, userId))).limit(1);
  if (!address) throw Errors.notFound('Address');
  if (!address.zoneId) throw Errors.outOfZone();

  const quote = await quoteCart(userId, address.zoneId);
  if (!quote.canPlaceOrder) {
    const first = quote.blockers[0];
    throw Errors.badRequest(first.message, first.code, { blockers: quote.blockers });
  }
  if (!quote.cart.vendor) throw Errors.emptyCart();

  const [customer] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const b = quote.breakdown;
  const code = generateOrderCode();

  const order = await db.transaction(async (tx) => {
    const [created] = await tx.insert(orders).values({
      code,
      customerId: userId,
      vendorId: quote.cart.vendor!.id,
      zoneId: address.zoneId!,
      addressId: address.id,
      status: 'PLACED',
      addressLine: address.line1,
      addressArea: address.area,
      addressLandmark: address.landmark,
      addressLatitude: address.latitude,
      addressLongitude: address.longitude,
      contactPhone: customer?.phone ?? '',
      subtotalPaise: b.subtotalPaise,
      deliveryFeePaise: b.deliveryFeePaise,
      platformFeePaise: b.platformFeePaise,
      taxPaise: b.taxPaise,
      discountPaise: b.discountPaise,
      totalPaise: b.totalPaise,
      commissionPaise: b.commissionPaise,
      paymentMethod: input.paymentMethod,
      paymentStatus: 'PENDING',
      etaMinutes: b.etaMinutes,
      cookingNote: input.cookingNote ?? null,
    }).returning();

    for (const item of quote.cart.items) {
      const [oi] = await tx.insert(orderItems).values({
        orderId: created.id,
        foodItemId: item.foodItemId,
        nameSnapshot: item.name,
        basePricePaise: item.basePricePaise,
        unitPricePaise: item.unitPricePaise,
        quantity: item.quantity,
        instructions: item.instructions,
      }).returning();

      if (item.options.length) {
        await tx.insert(orderItemOptions).values(item.options.map((o) => ({
          orderItemId: oi.id, nameSnapshot: o.name, priceDeltaPaise: o.priceDeltaPaise,
        })));
      }
    }

    await tx.insert(orderStatusEvents).values({
      orderId: created.id, status: 'PLACED', actorId: userId, note: 'Order placed by customer',
    });

    const provider = getPaymentProvider(input.paymentMethod);
    const intent = await provider.createIntent({ orderCode: code, amountPaise: b.totalPaise });
    await tx.insert(payments).values({
      orderId: created.id,
      provider: provider.name,
      status: input.paymentMethod === 'COD' ? 'PENDING' : 'AWAITING_VERIFICATION',
      amountPaise: b.totalPaise,
      providerRef: intent.reference,
      raw: { instructions: intent.instructions, upiUri: intent.upiUri ?? null },
    });

    return created;
  });

  await clearCart(userId);

  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, order.vendorId)).limit(1);
  if (vendor) {
    await notify({
      userId: vendor.ownerUserId, type: 'NEW_ORDER',
      title: 'New order received',
      body: `Order ${order.code} — ${quote.cart.itemCount} item(s).`,
      data: { orderId: order.id },
    });
  }

  return getOrderDetail(order.id);
}

export async function getOrderDetail(orderId: string) {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: {
      items: { with: { options: true } },
      vendor: true,
      zone: true,
      events: { orderBy: (t, { asc }) => [asc(t.createdAt)] },
      payment: true,
      customer: { columns: { id: true, fullName: true, phone: true } },
      review: true,
    },
  });
  if (!order) throw Errors.notFound('Order');

  const [assignment] = await db
    .select({ a: deliveryAssignments, p: deliveryPartners, u: users })
    .from(deliveryAssignments)
    .innerJoin(deliveryPartners, eq(deliveryAssignments.partnerId, deliveryPartners.id))
    .innerJoin(users, eq(deliveryPartners.userId, users.id))
    .where(and(eq(deliveryAssignments.orderId, orderId), inArray(deliveryAssignments.state, ['ACCEPTED', 'COMPLETED'])))
    .limit(1);

  return {
    ...order,
    statusLabel: STATUS_LABEL[order.status as OrderStatus],
    deliveryPartner: assignment
      ? {
          id: assignment.p.id, name: assignment.u.fullName, phone: assignment.u.phone,
          latitude: assignment.p.latitude, longitude: assignment.p.longitude,
          pickedUpAt: assignment.a.pickedUpAt,
        }
      : null,
  };
}

export async function listCustomerOrders(userId: string) {
  return db.query.orders.findMany({
    where: eq(orders.customerId, userId),
    with: { items: true, vendor: { columns: { id: true, name: true, slug: true, logoUrl: true } }, review: true },
    orderBy: [desc(orders.placedAt)],
    limit: 50,
  });
}

export async function listVendorOrders(vendorId: string, status?: OrderStatus) {
  return db.query.orders.findMany({
    where: status
      ? and(eq(orders.vendorId, vendorId), eq(orders.status, status))
      : eq(orders.vendorId, vendorId),
    with: {
      items: { with: { options: true } },
      customer: { columns: { id: true, fullName: true, phone: true } },
    },
    orderBy: [desc(orders.placedAt)],
    limit: 100,
  });
}

/**
 * The one place an order's status can change. Validates the transition, the
 * actor's right to make it, then writes the event and fires notifications.
 */
export async function changeStatus(input: {
  orderId: string;
  to: OrderStatus;
  actor: Actor;
  actorUserId?: string;
  note?: string;
}) {
  const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  if (!order) throw Errors.notFound('Order');

  const from = order.status as OrderStatus;
  if (from === input.to) return getOrderDetail(order.id);
  if (!canTransition(from, input.to)) throw Errors.invalidTransition(from, input.to);
  if (!actorCanSet(input.actor, input.to)) {
    throw Errors.forbidden(`A ${input.actor.toLowerCase()} cannot set an order to ${input.to}.`);
  }

  const patch: Partial<typeof orders.$inferInsert> = { status: input.to, updatedAt: new Date() };
  if (input.to === 'ACCEPTED') patch.acceptedAt = new Date();
  if (input.to === 'READY') patch.readyAt = new Date();
  if (input.to === 'DELIVERED') {
    patch.deliveredAt = new Date();
    if (order.paymentMethod === 'COD') patch.paymentStatus = 'PAID';
  }
  if (input.to === 'CANCELLED') {
    patch.cancelReason = input.note ?? 'Cancelled';
    patch.cancelledById = input.actorUserId ?? null;
  }

  await db.transaction(async (tx) => {
    await tx.update(orders).set(patch).where(eq(orders.id, order.id));
    await tx.insert(orderStatusEvents).values({
      orderId: order.id, status: input.to, actorId: input.actorUserId ?? null, note: input.note ?? null,
    });
    if (input.to === 'DELIVERED' && order.paymentMethod === 'COD') {
      await tx.update(payments).set({ status: 'PAID', updatedAt: new Date() }).where(eq(payments.orderId, order.id));
    }
  });

  const template = ORDER_NOTIFICATIONS[input.to];
  if (template) {
    await notify({
      userId: order.customerId, type: `ORDER_${input.to}`,
      title: template.title, body: `${template.body} (${order.code})`,
      data: { orderId: order.id },
    });
  }

  return getOrderDetail(order.id);
}

export async function cancelByCustomer(userId: string, orderId: string, reason?: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw Errors.notFound('Order');
  if (order.customerId !== userId) throw Errors.forbidden();

  const settings = await getSettings();
  const elapsed = (Date.now() - new Date(order.placedAt).getTime()) / 1000;
  if (order.status !== 'PLACED') {
    throw Errors.conflict('This order can no longer be cancelled. Please contact support.', 'CANCEL_WINDOW_CLOSED');
  }
  if (elapsed > settings.cancelWindowSeconds) {
    throw Errors.conflict(
      `Orders can only be cancelled within ${Math.round(settings.cancelWindowSeconds / 60)} minutes of placing.`,
      'CANCEL_WINDOW_CLOSED',
    );
  }
  return changeStatus({ orderId, to: 'CANCELLED', actor: 'CUSTOMER', actorUserId: userId, note: reason });
}

/** Recomputes a vendor's rating from visible reviews. Called after each review. */
export async function refreshVendorRating(vendorId: string) {
  const [agg] = await db
    .select({
      avg: sql<number>`coalesce(avg(${reviews.rating}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(reviews)
    .where(and(eq(reviews.vendorId, vendorId), eq(reviews.isHidden, false)));

  await db.update(vendors).set({
    ratingAvg: Math.round(Number(agg.avg) * 10) / 10,
    ratingCount: Number(agg.count),
    updatedAt: new Date(),
  }).where(eq(vendors.id, vendorId));
}

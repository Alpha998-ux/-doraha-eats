import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  carts, cartItems, cartItemOptions, foodItems, vendors, vendorHours,
  customizationOptions, customizationGroups,
} from '../db/schema.js';
import { Errors } from '../lib/errors.js';
import { buildLine, computeOrder, type PriceLine } from './pricing.service.js';
import { getSettings } from './settings.service.js';
import { getZoneById } from './zone.service.js';
import { isVendorOpen } from './vendorHours.service.js';

export async function getOrCreateCart(userId: string) {
  const [existing] = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(carts).values({ userId }).returning();
  return created;
}

export type CartView = {
  id: string;
  vendor: { id: string; name: string; slug: string; isOpen: boolean; prepTimeMinutes: number } | null;
  items: Array<{
    id: string; foodItemId: string; name: string; imageUrl: string | null; isVeg: boolean;
    basePricePaise: number; unitPricePaise: number; quantity: number;
    lineTotalPaise: number; instructions: string | null;
    isAvailable: boolean;
    options: Array<{ id: string; name: string; priceDeltaPaise: number }>;
  }>;
  subtotalPaise: number;
  itemCount: number;
};

export async function getCartView(userId: string): Promise<CartView> {
  const cart = await getOrCreateCart(userId);

  const items = await db.query.cartItems.findMany({
    where: eq(cartItems.cartId, cart.id),
    with: {
      foodItem: true,
      options: { with: { option: true } },
    },
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  let vendor: CartView['vendor'] = null;
  if (cart.vendorId) {
    const [v] = await db.select().from(vendors).where(eq(vendors.id, cart.vendorId)).limit(1);
    if (v) {
      const hours = await db.select().from(vendorHours).where(eq(vendorHours.vendorId, v.id));
      vendor = {
        id: v.id, name: v.name, slug: v.slug,
        isOpen: v.status === 'ACTIVE' && isVendorOpen(v.isOpenManual, hours),
        prepTimeMinutes: v.prepTimeMinutes,
      };
    }
  }

  const view = items.map((ci) => {
    const deltas = ci.options.map((o) => o.option.priceDeltaPaise);
    const unit = ci.foodItem.pricePaise + deltas.reduce((a, b) => a + b, 0);
    return {
      id: ci.id,
      foodItemId: ci.foodItemId,
      name: ci.foodItem.name,
      imageUrl: ci.foodItem.imageUrl,
      isVeg: ci.foodItem.isVeg,
      basePricePaise: ci.foodItem.pricePaise,
      unitPricePaise: unit,
      quantity: ci.quantity,
      lineTotalPaise: unit * ci.quantity,
      instructions: ci.instructions,
      isAvailable: ci.foodItem.isAvailable,
      options: ci.options.map((o) => ({
        id: o.option.id, name: o.option.name, priceDeltaPaise: o.option.priceDeltaPaise,
      })),
    };
  });

  return {
    id: cart.id,
    vendor,
    items: view,
    subtotalPaise: view.reduce((s, i) => s + i.lineTotalPaise, 0),
    itemCount: view.reduce((s, i) => s + i.quantity, 0),
  };
}

export async function addItem(userId: string, input: {
  foodItemId: string; quantity: number; optionIds?: string[]; instructions?: string;
}) {
  const cart = await getOrCreateCart(userId);

  const [item] = await db.select().from(foodItems).where(eq(foodItems.id, input.foodItemId)).limit(1);
  if (!item) throw Errors.notFound('Food item');
  if (!item.isAvailable) throw Errors.itemUnavailable(item.name);

  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, item.vendorId)).limit(1);
  if (!vendor || vendor.status !== 'ACTIVE') throw Errors.notFound('Stall');

  // Single-vendor cart: adding from another stall requires clearing first.
  if (cart.vendorId && cart.vendorId !== item.vendorId) {
    throw Errors.conflict(
      'Your cart has items from another stall. Clear it to order from this one.',
      'DIFFERENT_VENDOR',
    );
  }

  const optionIds = input.optionIds ?? [];
  if (optionIds.length) {
    const opts = await db
      .select({ opt: customizationOptions, grp: customizationGroups })
      .from(customizationOptions)
      .innerJoin(customizationGroups, eq(customizationOptions.groupId, customizationGroups.id))
      .where(inArray(customizationOptions.id, optionIds));

    if (opts.length !== optionIds.length) throw Errors.badRequest('Invalid customization selected.');
    for (const { opt, grp } of opts) {
      if (grp.foodItemId !== item.id) throw Errors.badRequest('Customization does not belong to this item.');
      if (!opt.isAvailable) throw Errors.itemUnavailable(opt.name);
    }
    // enforce each group's min/max
    const groups = await db.select().from(customizationGroups).where(eq(customizationGroups.foodItemId, item.id));
    for (const g of groups) {
      const chosen = opts.filter((o) => o.grp.id === g.id).length;
      if (chosen < g.minSelect) throw Errors.badRequest(`Please choose an option for ${g.name}.`);
      if (chosen > g.maxSelect) throw Errors.badRequest(`You can choose at most ${g.maxSelect} in ${g.name}.`);
    }
  }

  if (!cart.vendorId) {
    await db.update(carts).set({ vendorId: item.vendorId, updatedAt: new Date() }).where(eq(carts.id, cart.id));
  }

  const [ci] = await db.insert(cartItems).values({
    cartId: cart.id, foodItemId: item.id, quantity: input.quantity,
    instructions: input.instructions ?? null,
  }).returning();

  if (optionIds.length) {
    await db.insert(cartItemOptions).values(optionIds.map((optionId) => ({ cartItemId: ci.id, optionId })));
  }
  return getCartView(userId);
}

export async function updateItem(userId: string, cartItemId: string, quantity: number) {
  const cart = await getOrCreateCart(userId);
  const [existing] = await db
    .select().from(cartItems)
    .where(and(eq(cartItems.id, cartItemId), eq(cartItems.cartId, cart.id))).limit(1);
  if (!existing) throw Errors.notFound('Cart item');

  if (quantity <= 0) return removeItem(userId, cartItemId);
  await db.update(cartItems).set({ quantity, updatedAt: new Date() }).where(eq(cartItems.id, cartItemId));
  return getCartView(userId);
}

export async function removeItem(userId: string, cartItemId: string) {
  const cart = await getOrCreateCart(userId);
  await db.delete(cartItems).where(and(eq(cartItems.id, cartItemId), eq(cartItems.cartId, cart.id)));
  const remaining = await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id));
  if (!remaining.length) {
    await db.update(carts).set({ vendorId: null, updatedAt: new Date() }).where(eq(carts.id, cart.id));
  }
  return getCartView(userId);
}

export async function clearCart(userId: string) {
  const cart = await getOrCreateCart(userId);
  await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
  await db.update(carts).set({ vendorId: null, updatedAt: new Date() }).where(eq(carts.id, cart.id));
  return getCartView(userId);
}

export type Quote = Awaited<ReturnType<typeof quoteCart>>;

/**
 * The checkout gate. Returns the full price breakdown AND a list of blockers so
 * the app can disable "Place Order" with a specific reason instead of failing late.
 */
export async function quoteCart(userId: string, zoneId: string) {
  const view = await getCartView(userId);
  const blockers: Array<{ code: string; message: string }> = [];

  if (!view.items.length) blockers.push({ code: 'EMPTY_CART', message: 'Your cart is empty.' });

  const zone = await getZoneById(zoneId);
  if (!zone || !zone.isActive) {
    blockers.push({ code: 'OUT_OF_ZONE', message: 'Delivery is currently unavailable at this location.' });
  }
  if (view.vendor && !view.vendor.isOpen) {
    blockers.push({ code: 'VENDOR_CLOSED', message: `${view.vendor.name} is closed right now.` });
  }
  for (const item of view.items) {
    if (!item.isAvailable) {
      blockers.push({ code: 'ITEM_UNAVAILABLE', message: `${item.name} is not available right now.` });
    }
  }

  const settings = await getSettings();
  const effectiveZone = zone ?? { deliveryFeePaise: 0, minOrderPaise: 0, etaMinutes: 0 };

  let vendorCommissionPct: number | null = null;
  if (view.vendor) {
    const [v] = await db.select().from(vendors).where(eq(vendors.id, view.vendor.id)).limit(1);
    vendorCommissionPct = v?.commissionPct ?? null;
  }

  const lines: PriceLine[] = view.items.map((i) =>
    buildLine({
      foodItemId: i.foodItemId, name: i.name, basePricePaise: i.basePricePaise,
      optionDeltas: i.options.map((o) => o.priceDeltaPaise), quantity: i.quantity,
    }),
  );

  const breakdown = computeOrder({ lines, zone: effectiveZone, settings, vendorCommissionPct });

  if (zone && breakdown.subtotalPaise > 0 && breakdown.subtotalPaise < zone.minOrderPaise) {
    blockers.push({
      code: 'BELOW_MINIMUM',
      message: `Minimum order for ${zone.name} is Rs ${(zone.minOrderPaise / 100).toFixed(0)}.`,
    });
  }

  const etaMinutes = breakdown.etaMinutes + (view.vendor?.prepTimeMinutes ?? 0);

  return {
    cart: view,
    zone: zone ? { id: zone.id, name: zone.name } : null,
    breakdown: { ...breakdown, etaMinutes },
    blockers,
    canPlaceOrder: blockers.length === 0,
  };
}

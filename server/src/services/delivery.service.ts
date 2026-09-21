import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { deliveryAssignments, deliveryPartners, orders, users, vendors } from '../db/schema.js';
import { Errors } from '../lib/errors.js';
import { distanceMeters } from '../lib/geo.js';
import { changeStatus } from './order.service.js';
import { getSettings } from './settings.service.js';
import { notify } from './notification.service.js';

export async function getPartnerByUserId(userId: string) {
  const [p] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.userId, userId)).limit(1);
  if (!p) throw Errors.notFound('Delivery partner profile');
  return p;
}

export async function setOnline(userId: string, isOnline: boolean) {
  const partner = await getPartnerByUserId(userId);
  if (partner.status !== 'ACTIVE') {
    throw Errors.forbidden('Your account is awaiting admin approval.');
  }
  const [updated] = await db.update(deliveryPartners)
    .set({ isOnline, lastSeenAt: new Date(), updatedAt: new Date() })
    .where(eq(deliveryPartners.id, partner.id)).returning();
  return updated;
}

export async function updateLocation(userId: string, latitude: number, longitude: number) {
  const partner = await getPartnerByUserId(userId);
  const [updated] = await db.update(deliveryPartners)
    .set({ latitude, longitude, lastSeenAt: new Date(), updatedAt: new Date() })
    .where(eq(deliveryPartners.id, partner.id)).returning();
  return updated;
}

/**
 * Open jobs: orders that are READY and not yet claimed by anyone, nearest stall
 * first. Polling-based, so no queue infrastructure is needed for the MVP.
 */
export async function listAvailableDeliveries(userId: string) {
  const partner = await getPartnerByUserId(userId);
  if (partner.status !== 'ACTIVE') throw Errors.forbidden('Your account is awaiting admin approval.');

  const claimed = await db
    .select({ orderId: deliveryAssignments.orderId })
    .from(deliveryAssignments)
    .where(inArray(deliveryAssignments.state, ['ACCEPTED', 'COMPLETED']));
  const claimedIds = new Set(claimed.map((c) => c.orderId));

  const ready = await db.query.orders.findMany({
    where: eq(orders.status, 'READY'),
    with: {
      vendor: { columns: { id: true, name: true, addressLine: true, latitude: true, longitude: true, phone: true } },
      items: true,
    },
    orderBy: [desc(orders.readyAt)],
    limit: 50,
  });

  const settings = await getSettings();

  return ready
    .filter((o) => !claimedIds.has(o.id))
    .map((o) => ({
      orderId: o.id,
      code: o.code,
      vendor: o.vendor,
      itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
      totalPaise: o.totalPaise,
      paymentMethod: o.paymentMethod,
      codToCollectPaise: o.paymentMethod === 'COD' ? o.totalPaise : 0,
      payoutPaise: settings.riderPayoutPaise,
      dropArea: o.addressArea,
      dropLine: o.addressLine,
      pickupDistanceMeters:
        partner.latitude != null && partner.longitude != null
          ? distanceMeters(partner.latitude, partner.longitude, o.vendor.latitude, o.vendor.longitude)
          : null,
      dropDistanceMeters: distanceMeters(
        o.vendor.latitude, o.vendor.longitude, o.addressLatitude, o.addressLongitude,
      ),
      readyAt: o.readyAt,
    }))
    .sort((a, b) => (a.pickupDistanceMeters ?? 1e9) - (b.pickupDistanceMeters ?? 1e9));
}

/**
 * Claim a delivery. The DB unique index on (orderId, partnerId) plus the
 * status check make a double-accept race resolve to exactly one winner.
 */
export async function acceptDelivery(userId: string, orderId: string) {
  const partner = await getPartnerByUserId(userId);
  if (partner.status !== 'ACTIVE') throw Errors.forbidden('Your account is awaiting admin approval.');
  if (!partner.isOnline) throw Errors.badRequest('Go online before accepting deliveries.', 'OFFLINE');

  const settings = await getSettings();

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw Errors.notFound('Order');
  if (order.status !== 'READY') {
    throw Errors.conflict('This delivery is no longer available.', 'ALREADY_TAKEN');
  }

  const [taken] = await db.select().from(deliveryAssignments)
    .where(and(eq(deliveryAssignments.orderId, orderId), eq(deliveryAssignments.state, 'ACCEPTED'))).limit(1);
  if (taken) throw Errors.conflict('This delivery is no longer available.', 'ALREADY_TAKEN');

  await db.insert(deliveryAssignments).values({
    orderId, partnerId: partner.id, state: 'ACCEPTED',
    payoutPaise: settings.riderPayoutPaise, respondedAt: new Date(),
  }).onConflictDoUpdate({
    target: [deliveryAssignments.orderId, deliveryAssignments.partnerId],
    set: { state: 'ACCEPTED', respondedAt: new Date(), updatedAt: new Date() },
  });

  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, order.vendorId)).limit(1);
  if (vendor) {
    await notify({
      userId: vendor.ownerUserId, type: 'RIDER_ASSIGNED',
      title: 'Delivery partner assigned',
      body: `A delivery partner is coming for order ${order.code}.`,
      data: { orderId: order.id },
    });
  }

  return changeStatus({ orderId, to: 'ASSIGNED', actor: 'DELIVERY', actorUserId: userId });
}

async function requireOwnAssignment(userId: string, orderId: string) {
  const partner = await getPartnerByUserId(userId);
  const [a] = await db.select().from(deliveryAssignments)
    .where(and(
      eq(deliveryAssignments.orderId, orderId),
      eq(deliveryAssignments.partnerId, partner.id),
      inArray(deliveryAssignments.state, ['ACCEPTED', 'COMPLETED']),
    )).limit(1);
  if (!a) throw Errors.forbidden('This delivery is not assigned to you.');
  return { partner, assignment: a };
}

export async function markPickedUp(userId: string, orderId: string) {
  const { assignment } = await requireOwnAssignment(userId, orderId);
  await db.update(deliveryAssignments)
    .set({ pickedUpAt: new Date(), updatedAt: new Date() })
    .where(eq(deliveryAssignments.id, assignment.id));
  return changeStatus({ orderId, to: 'PICKED_UP', actor: 'DELIVERY', actorUserId: userId });
}

export async function markOnTheWay(userId: string, orderId: string) {
  await requireOwnAssignment(userId, orderId);
  return changeStatus({ orderId, to: 'ON_THE_WAY', actor: 'DELIVERY', actorUserId: userId });
}

export async function markDelivered(userId: string, orderId: string, codCollectedPaise?: number) {
  const { assignment } = await requireOwnAssignment(userId, orderId);
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw Errors.notFound('Order');

  if (order.paymentMethod === 'COD') {
    const collected = codCollectedPaise ?? order.totalPaise;
    if (collected < order.totalPaise) {
      throw Errors.badRequest('Collected amount is less than the order total.', 'COD_SHORTFALL');
    }
  }

  await db.update(deliveryAssignments).set({
    state: 'COMPLETED',
    deliveredAt: new Date(),
    codCollectedPaise: order.paymentMethod === 'COD' ? (codCollectedPaise ?? order.totalPaise) : null,
    updatedAt: new Date(),
  }).where(eq(deliveryAssignments.id, assignment.id));

  return changeStatus({ orderId, to: 'DELIVERED', actor: 'DELIVERY', actorUserId: userId });
}

export async function listPartnerHistory(userId: string) {
  const partner = await getPartnerByUserId(userId);
  const rows = await db
    .select({ a: deliveryAssignments, o: orders })
    .from(deliveryAssignments)
    .innerJoin(orders, eq(deliveryAssignments.orderId, orders.id))
    .where(eq(deliveryAssignments.partnerId, partner.id))
    .orderBy(desc(deliveryAssignments.createdAt))
    .limit(100);
  return rows.map((r) => ({
    assignmentId: r.a.id, state: r.a.state, payoutPaise: r.a.payoutPaise,
    deliveredAt: r.a.deliveredAt,
    order: { id: r.o.id, code: r.o.code, status: r.o.status, totalPaise: r.o.totalPaise, area: r.o.addressArea },
  }));
}

export async function getPartnerEarnings(userId: string) {
  const history = await listPartnerHistory(userId);
  const completed = history.filter((h) => h.state === 'COMPLETED');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todays = completed.filter((h) => h.deliveredAt && new Date(h.deliveredAt) >= today);
  return {
    totalDeliveries: completed.length,
    totalEarningsPaise: completed.reduce((s, h) => s + h.payoutPaise, 0),
    todayDeliveries: todays.length,
    todayEarningsPaise: todays.reduce((s, h) => s + h.payoutPaise, 0),
  };
}

/** Admin override — hand an order to a specific partner. */
export async function adminAssign(orderId: string, partnerId: string, adminUserId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw Errors.notFound('Order');
  const settings = await getSettings();
  await db.insert(deliveryAssignments).values({
    orderId, partnerId, state: 'ACCEPTED', payoutPaise: settings.riderPayoutPaise, respondedAt: new Date(),
  }).onConflictDoUpdate({
    target: [deliveryAssignments.orderId, deliveryAssignments.partnerId],
    set: { state: 'ACCEPTED', respondedAt: new Date(), updatedAt: new Date() },
  });
  return changeStatus({ orderId, to: 'ASSIGNED', actor: 'ADMIN', actorUserId: adminUserId, note: 'Assigned by admin' });
}

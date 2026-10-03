import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { addresses, favorites, notifications, complaints, orders, reviews, payments } from '../db/schema.js';
import { resolveZone } from '../services/zone.service.js';
import * as cart from '../services/cart.service.js';
import * as orderService from '../services/order.service.js';
import { Errors } from '../lib/errors.js';
import { getPaymentProvider } from '../adapters/payments/index.js';

export const customerRouter = Router();
customerRouter.use(authenticate, requireRole('CUSTOMER', 'ADMIN'));

/* ------------------------------------------------------------- addresses */

customerRouter.get('/addresses', async (req, res, next) => {
  try {
    const rows = await db.select().from(addresses)
      .where(eq(addresses.userId, req.user!.id)).orderBy(desc(addresses.isDefault));
    res.json({ addresses: rows });
  } catch (e) { next(e); }
});

customerRouter.post('/addresses', validate({
  body: z.object({
    label: z.enum(['HOME', 'WORK', 'OTHER']).default('HOME'),
    area: z.string().min(2),
    line1: z.string().min(3),
    landmark: z.string().optional(),
    pincode: z.string().optional(),
    latitude: z.number(),
    longitude: z.number(),
    isDefault: z.boolean().optional(),
  }),
}), async (req, res, next) => {
  try {
    // The zone is resolved server-side; the client cannot claim to be in one.
    const zone = await resolveZone(req.body.latitude, req.body.longitude);
    if (req.body.isDefault) {
      await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, req.user!.id));
    }
    const [row] = await db.insert(addresses).values({
      ...req.body, userId: req.user!.id, zoneId: zone.zone?.id ?? null,
    }).returning();
    res.status(201).json({
      address: row,
      serviceable: zone.serviceable,
      message: zone.serviceable ? null : 'Delivery is currently unavailable at this location.',
    });
  } catch (e) { next(e); }
});

customerRouter.delete('/addresses/:id', async (req, res, next) => {
  try {
    await db.delete(addresses).where(and(eq(addresses.id, req.params.id), eq(addresses.userId, req.user!.id)));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ------------------------------------------------------------------ cart */

customerRouter.get('/cart', async (req, res, next) => {
  try { res.json({ cart: await cart.getCartView(req.user!.id) }); } catch (e) { next(e); }
});

customerRouter.post('/cart/items', validate({
  body: z.object({
    foodItemId: z.string().uuid(),
    quantity: z.number().int().min(1).max(50),
    optionIds: z.array(z.string().uuid()).optional(),
    instructions: z.string().max(200).optional(),
  }),
}), async (req, res, next) => {
  try { res.status(201).json({ cart: await cart.addItem(req.user!.id, req.body) }); } catch (e) { next(e); }
});

customerRouter.patch('/cart/items/:id', validate({
  body: z.object({ quantity: z.number().int().min(0).max(50) }),
}), async (req, res, next) => {
  try {
    res.json({ cart: await cart.updateItem(req.user!.id, req.params.id, req.body.quantity) });
  } catch (e) { next(e); }
});

customerRouter.delete('/cart/items/:id', async (req, res, next) => {
  try { res.json({ cart: await cart.removeItem(req.user!.id, req.params.id) }); } catch (e) { next(e); }
});

customerRouter.delete('/cart', async (req, res, next) => {
  try { res.json({ cart: await cart.clearCart(req.user!.id) }); } catch (e) { next(e); }
});

customerRouter.post('/cart/quote', validate({
  body: z.object({ addressId: z.string().uuid() }),
}), async (req, res, next) => {
  try {
    const [address] = await db.select().from(addresses)
      .where(and(eq(addresses.id, req.body.addressId), eq(addresses.userId, req.user!.id))).limit(1);
    if (!address) throw Errors.notFound('Address');
    if (!address.zoneId) throw Errors.outOfZone();
    res.json(await cart.quoteCart(req.user!.id, address.zoneId));
  } catch (e) { next(e); }
});

/* ---------------------------------------------------------------- orders */

customerRouter.post('/orders', validate({
  body: z.object({
    addressId: z.string().uuid(),
    paymentMethod: z.enum(['COD', 'UPI']),
    cookingNote: z.string().max(200).optional(),
  }),
}), async (req, res, next) => {
  try { res.status(201).json({ order: await orderService.placeOrder(req.user!.id, req.body) }); }
  catch (e) { next(e); }
});

customerRouter.get('/orders', async (req, res, next) => {
  try { res.json({ orders: await orderService.listCustomerOrders(req.user!.id) }); } catch (e) { next(e); }
});

customerRouter.get('/orders/:id', async (req, res, next) => {
  try {
    const order = await orderService.getOrderDetail(req.params.id);
    if (order.customerId !== req.user!.id && req.user!.role !== 'ADMIN') throw Errors.forbidden();
    res.json({ order });
  } catch (e) { next(e); }
});

customerRouter.post('/orders/:id/cancel', validate({
  body: z.object({ reason: z.string().max(200).optional() }),
}), async (req, res, next) => {
  try {
    const order = await orderService.getOrderDetail(req.params.id);
    if (order.customerId !== req.user!.id) throw Errors.forbidden();
    
    // Prevent cancellation once vendor has accepted or started preparing
    if (['PREPARING', 'READY', 'DISPATCHED', 'DELIVERED', 'CANCELLED'].includes(order.status)) {
      throw Errors.badRequest('Order cannot be cancelled at this stage. Please contact support.');
    }

    res.json({ order: await orderService.cancelByCustomer(req.user!.id, req.params.id, req.body.reason) });
  } catch (e) { next(e); }
});

/** UPI Verification: customer submits UTR; checks duplicates & enforces idempotent transition */
customerRouter.post('/orders/:id/payment/upi-ref', validate({
  body: z.object({ utr: z.string().regex(/^\d{12}$/, 'UTR must be a 12-digit numeric reference number') }),
}), async (req, res, next) => {
  try {
    const order = await orderService.getOrderDetail(req.params.id);
    if (order.customerId !== req.user!.id) throw Errors.forbidden();
    if (order.paymentMethod !== 'UPI') throw Errors.badRequest('This order is not a UPI order.');
    if (order.paymentStatus === 'PAID') throw Errors.badRequest('This order has already been paid for.');

    // Enforce UTR anti-replay check
    const [existingUtr] = await db.select().from(payments)
      .where(and(eq(payments.upiRef, req.body.utr), eq(payments.status, 'PAID'))).limit(1);
    
    if (existingUtr) {
      throw Errors.conflict('This UPI reference number (UTR) has already been used for another payment.');
    }

    const provider = getPaymentProvider('UPI');
    const result = await provider.verify({
      reference: order.payment?.providerRef ?? order.code, upiRef: req.body.utr,
    });

    await db.update(payments).set({
      upiRef: req.body.utr,
      status: result.paid ? 'PAID' : 'AWAITING_VERIFICATION',
      providerRef: result.providerRef ?? order.payment?.providerRef ?? null,
      updatedAt: new Date(),
    }).where(eq(payments.orderId, order.id));

    if (result.paid) {
      await db.update(orders).set({ paymentStatus: 'PAID', updatedAt: new Date() }).where(eq(orders.id, order.id));
    }
    res.json({ verified: result.paid, order: await orderService.getOrderDetail(order.id) });
  } catch (e) { next(e); }
});

/* --------------------------------------------------------------- reviews */

customerRouter.post('/orders/:id/review', validate({
  body: z.object({
    rating: z.number().int().min(1).max(5),
    deliveryRating: z.number().int().min(1).max(5).optional(),
    comment: z.string().max(500).optional(),
  }),
}), async (req, res, next) => {
  try {
    const order = await orderService.getOrderDetail(req.params.id);
    if (order.customerId !== req.user!.id) throw Errors.forbidden();
    if (order.status !== 'DELIVERED') {
      throw Errors.badRequest('You can review an order once it has been delivered.', 'NOT_DELIVERED');
    }
    const [existing] = await db.select().from(reviews).where(eq(reviews.orderId, order.id)).limit(1);
    if (existing) throw Errors.conflict('You have already reviewed this order.', 'ALREADY_REVIEWED');

    const [review] = await db.insert(reviews).values({
      orderId: order.id, customerId: req.user!.id, vendorId: order.vendorId,
      partnerId: order.deliveryPartner?.id ?? null,
      rating: req.body.rating, deliveryRating: req.body.deliveryRating ?? null,
      comment: req.body.comment ?? null,
    }).returning();

    await orderService.refreshVendorRating(order.vendorId);
    res.status(201).json({ review });
  } catch (e) { next(e); }
});

/* ------------------------------------------------- favorites / notifications */

customerRouter.get('/favorites', async (req, res, next) => {
  try {
    const rows = await db.query.favorites.findMany({
      where: eq(favorites.userId, req.user!.id),
      with: { vendor: true, foodItem: true },
    });
    res.json({ favorites: rows });
  } catch (e) { next(e); }
});

customerRouter.post('/favorites', validate({
  body: z.object({ vendorId: z.string().uuid().optional(), foodItemId: z.string().uuid().optional() })
    .refine((v) => !!v.vendorId !== !!v.foodItemId, 'Provide exactly one of vendorId or foodItemId'),
}), async (req, res, next) => {
  try {
    const [row] = await db.insert(favorites)
      .values({ userId: req.user!.id, vendorId: req.body.vendorId ?? null, foodItemId: req.body.foodItemId ?? null })
      .onConflictDoNothing().returning();
    res.status(201).json({ favorite: row ?? null });
  } catch (e) { next(e); }
});

customerRouter.delete('/favorites/:id', async (req, res, next) => {
  try {
    await db.delete(favorites).where(and(eq(favorites.id, req.params.id), eq(favorites.userId, req.user!.id)));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

customerRouter.get('/notifications', async (req, res, next) => {
  try {
    const rows = await db.select().from(notifications)
      .where(eq(notifications.userId, req.user!.id))
      .orderBy(desc(notifications.createdAt)).limit(50);
    res.json({ notifications: rows, unread: rows.filter((r) => !r.readAt).length });
  } catch (e) { next(e); }
});

customerRouter.post('/notifications/:id/read', async (req, res, next) => {
  try {
    await db.update(notifications).set({ readAt: new Date() })
      .where(and(eq(notifications.id, req.params.id), eq(notifications.userId, req.user!.id)));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

customerRouter.post('/complaints', validate({
  body: z.object({
    subject: z.string().min(3).max(120),
    message: z.string().min(5).max(1000),
    orderId: z.string().uuid().optional(),
  }),
}), async (req, res, next) => {
  try {
    const [row] = await db.insert(complaints).values({
      userId: req.user!.id, subject: req.body.subject,
      message: req.body.message, orderId: req.body.orderId ?? null,
    }).returning();
    res.status(201).json({ complaint: row });
  } catch (e) { next(e); }
});

customerRouter.get('/complaints', async (req, res, next) => {
  try {
    const rows = await db.select().from(complaints)
      .where(eq(complaints.userId, req.user!.id)).orderBy(desc(complaints.createdAt));
    res.json({ complaints: rows });
  } catch (e) { next(e); }
});

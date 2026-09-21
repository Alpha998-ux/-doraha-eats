import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { db } from '../db/index.js';
import {
  vendors, vendorHours, menuSections, foodItems, customizationGroups,
  customizationOptions, orders, reviews, users,
} from '../db/schema.js';
import { Errors } from '../lib/errors.js';
import * as orderService from '../services/order.service.js';
import { isVendorOpen } from '../services/vendorHours.service.js';
import { storageProvider } from '../adapters/storage/index.js';

export const vendorRouter = Router();
vendorRouter.use(authenticate, requireRole('VENDOR'));

/** Resolves the caller's own stall. A vendor can never touch another's data. */
async function myVendor(userId: string) {
  const [v] = await db.select().from(vendors).where(eq(vendors.ownerUserId, userId)).limit(1);
  if (!v) throw Errors.notFound('Vendor profile');
  return v;
}

async function ownItem(userId: string, itemId: string) {
  const v = await myVendor(userId);
  const [item] = await db.select().from(foodItems)
    .where(and(eq(foodItems.id, itemId), eq(foodItems.vendorId, v.id))).limit(1);
  if (!item) throw Errors.notFound('Food item');
  return { vendor: v, item };
}

vendorRouter.get('/me', async (req, res, next) => {
  try {
    const v = await myVendor(req.user!.id);
    const hours = await db.select().from(vendorHours).where(eq(vendorHours.vendorId, v.id));
    res.json({ vendor: { ...v, hours, isOpen: isVendorOpen(v.isOpenManual, hours) } });
  } catch (e) { next(e); }
});

vendorRouter.patch('/me', validate({
  body: z.object({
    name: z.string().min(2).optional(),
    about: z.string().max(500).optional(),
    phone: z.string().min(10).optional(),
    addressLine: z.string().min(3).optional(),
    prepTimeMinutes: z.number().int().min(1).max(180).optional(),
    isOpenManual: z.boolean().optional(),
    logoUrl: z.string().optional(),
    coverUrl: z.string().optional(),
  }),
}), async (req, res, next) => {
  try {
    const v = await myVendor(req.user!.id);
    const [updated] = await db.update(vendors)
      .set({ ...req.body, updatedAt: new Date() }).where(eq(vendors.id, v.id)).returning();
    res.json({ vendor: updated });
  } catch (e) { next(e); }
});

vendorRouter.put('/hours', validate({
  body: z.object({
    hours: z.array(z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      opensAt: z.string().regex(/^\d{2}:\d{2}$/),
      closesAt: z.string().regex(/^\d{2}:\d{2}$/),
    })).max(21),
  }),
}), async (req, res, next) => {
  try {
    const v = await myVendor(req.user!.id);
    await db.delete(vendorHours).where(eq(vendorHours.vendorId, v.id));
    if (req.body.hours.length) {
      await db.insert(vendorHours).values(req.body.hours.map((h: never) => ({ ...(h as object), vendorId: v.id })));
    }
    const hours = await db.select().from(vendorHours).where(eq(vendorHours.vendorId, v.id));
    res.json({ hours });
  } catch (e) { next(e); }
});

/* ------------------------------------------------------------------ menu */

vendorRouter.get('/menu', async (req, res, next) => {
  try {
    const v = await myVendor(req.user!.id);
    const sections = await db.query.menuSections.findMany({
      where: eq(menuSections.vendorId, v.id),
      orderBy: (t, { asc }) => [asc(t.sortOrder)],
      with: { foodItems: { with: { customizationGroups: { with: { options: true } } } } },
    });
    res.json({ sections });
  } catch (e) { next(e); }
});

vendorRouter.post('/menu/sections', validate({
  body: z.object({ name: z.string().min(1), sortOrder: z.number().int().optional() }),
}), async (req, res, next) => {
  try {
    const v = await myVendor(req.user!.id);
    const [row] = await db.insert(menuSections)
      .values({ vendorId: v.id, name: req.body.name, sortOrder: req.body.sortOrder ?? 0 }).returning();
    res.status(201).json({ section: row });
  } catch (e) { next(e); }
});

vendorRouter.post('/menu/items', validate({
  body: z.object({
    name: z.string().min(1),
    description: z.string().max(400).optional(),
    pricePaise: z.number().int().min(100),
    sectionId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    isVeg: z.boolean().default(true),
    imageUrl: z.string().optional(),
    prepTimeMinutes: z.number().int().min(1).max(180).optional(),
    sortOrder: z.number().int().optional(),
  }),
}), async (req, res, next) => {
  try {
    const v = await myVendor(req.user!.id);
    const [row] = await db.insert(foodItems).values({ ...req.body, vendorId: v.id }).returning();
    res.status(201).json({ item: row });
  } catch (e) { next(e); }
});

vendorRouter.patch('/menu/items/:id', validate({
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().max(400).optional(),
    pricePaise: z.number().int().min(100).optional(),
    isVeg: z.boolean().optional(),
    isAvailable: z.boolean().optional(),
    imageUrl: z.string().optional(),
    sectionId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    prepTimeMinutes: z.number().int().min(1).max(180).optional(),
  }),
}), async (req, res, next) => {
  try {
    const { item } = await ownItem(req.user!.id, req.params.id);
    const [updated] = await db.update(foodItems)
      .set({ ...req.body, updatedAt: new Date() }).where(eq(foodItems.id, item.id)).returning();
    res.json({ item: updated });
  } catch (e) { next(e); }
});

vendorRouter.delete('/menu/items/:id', async (req, res, next) => {
  try {
    const { item } = await ownItem(req.user!.id, req.params.id);
    await db.delete(foodItems).where(eq(foodItems.id, item.id));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

vendorRouter.post('/menu/items/:id/customizations', validate({
  body: z.object({
    name: z.string().min(1),
    minSelect: z.number().int().min(0).max(10).default(0),
    maxSelect: z.number().int().min(1).max(10).default(1),
    options: z.array(z.object({
      name: z.string().min(1),
      priceDeltaPaise: z.number().int().default(0),
      isDefault: z.boolean().default(false),
    })).min(1),
  }),
}), async (req, res, next) => {
  try {
    const { item } = await ownItem(req.user!.id, req.params.id);
    const [group] = await db.insert(customizationGroups).values({
      foodItemId: item.id, name: req.body.name,
      minSelect: req.body.minSelect, maxSelect: req.body.maxSelect,
    }).returning();
    const options = await db.insert(customizationOptions)
      .values(req.body.options.map((o: { name: string; priceDeltaPaise: number; isDefault: boolean }, i: number) => ({
        groupId: group.id, name: o.name, priceDeltaPaise: o.priceDeltaPaise,
        isDefault: o.isDefault, sortOrder: i,
      }))).returning();
    res.status(201).json({ group: { ...group, options } });
  } catch (e) { next(e); }
});

vendorRouter.post('/uploads/sign', validate({
  body: z.object({ filename: z.string().min(1), contentType: z.string().min(3) }),
}), async (req, res, next) => {
  try {
    const v = await myVendor(req.user!.id);
    const key = `vendors/${v.id}/${Date.now()}-${req.body.filename}`;
    res.json(await storageProvider.signedUpload(key, req.body.contentType));
  } catch (e) { next(e); }
});

/* ---------------------------------------------------------------- orders */

vendorRouter.get('/orders', validate({
  query: z.object({
    status: z.enum(['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED',
      'PICKED_UP', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED']).optional(),
  }),
}), async (req, res, next) => {
  try {
    const v = await myVendor(req.user!.id);
    res.json({ orders: await orderService.listVendorOrders(v.id, req.query.status as never) });
  } catch (e) { next(e); }
});

vendorRouter.get('/orders/:id', async (req, res, next) => {
  try {
    const v = await myVendor(req.user!.id);
    const order = await orderService.getOrderDetail(req.params.id);
    if (order.vendorId !== v.id) throw Errors.forbidden();
    res.json({ order });
  } catch (e) { next(e); }
});

/** Accept / reject / preparing / ready — all go through the status machine. */
const vendorAction = (to: 'ACCEPTED' | 'PREPARING' | 'READY' | 'CANCELLED') =>
  async (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    try {
      const v = await myVendor(req.user!.id);
      const existing = await orderService.getOrderDetail(req.params.id);
      if (existing.vendorId !== v.id) throw Errors.forbidden();

      if (to === 'ACCEPTED' && req.body?.prepTimeMinutes) {
        await db.update(orders)
          .set({ etaMinutes: existing.zone.etaMinutes + Number(req.body.prepTimeMinutes) })
          .where(eq(orders.id, existing.id));
      }
      const order = await orderService.changeStatus({
        orderId: req.params.id, to, actor: 'VENDOR',
        actorUserId: req.user!.id, note: req.body?.reason,
      });
      res.json({ order });
    } catch (e) { next(e); }
  };

vendorRouter.post('/orders/:id/accept', validate({
  body: z.object({ prepTimeMinutes: z.number().int().min(1).max(180).optional() }),
}), vendorAction('ACCEPTED'));

vendorRouter.post('/orders/:id/reject', validate({
  body: z.object({ reason: z.string().min(3).max(200) }),
}), vendorAction('CANCELLED'));

vendorRouter.post('/orders/:id/preparing', vendorAction('PREPARING'));
vendorRouter.post('/orders/:id/ready', vendorAction('READY'));

/* -------------------------------------------------------------- earnings */

vendorRouter.get('/earnings', async (req, res, next) => {
  try {
    const v = await myVendor(req.user!.id);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [all] = await db.select({
      count: sql<number>`count(*)`,
      gross: sql<number>`coalesce(sum(${orders.subtotalPaise}), 0)`,
      commission: sql<number>`coalesce(sum(${orders.commissionPaise}), 0)`,
    }).from(orders).where(and(eq(orders.vendorId, v.id), eq(orders.status, 'DELIVERED')));

    const [todayAgg] = await db.select({
      count: sql<number>`count(*)`,
      gross: sql<number>`coalesce(sum(${orders.subtotalPaise}), 0)`,
    }).from(orders).where(and(
      eq(orders.vendorId, v.id), eq(orders.status, 'DELIVERED'), gte(orders.placedAt, today),
    ));

    res.json({
      allTime: {
        orders: Number(all.count),
        grossPaise: Number(all.gross),
        commissionPaise: Number(all.commission),
        netPaise: Number(all.gross) - Number(all.commission),
      },
      today: { orders: Number(todayAgg.count), grossPaise: Number(todayAgg.gross) },
    });
  } catch (e) { next(e); }
});

vendorRouter.get('/reviews', async (req, res, next) => {
  try {
    const v = await myVendor(req.user!.id);
    const rows = await db.select({
      id: reviews.id, rating: reviews.rating, comment: reviews.comment,
      createdAt: reviews.createdAt, customerName: users.fullName,
    }).from(reviews).innerJoin(users, eq(reviews.customerId, users.id))
      .where(and(eq(reviews.vendorId, v.id), eq(reviews.isHidden, false)))
      .orderBy(desc(reviews.createdAt)).limit(50);
    res.json({ reviews: rows, ratingAvg: v.ratingAvg, ratingCount: v.ratingCount });
  } catch (e) { next(e); }
});

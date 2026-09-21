import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as delivery from '../services/delivery.service.js';
import * as orderService from '../services/order.service.js';
import { mapsProvider } from '../adapters/maps/index.js';

export const deliveryRouter = Router();
deliveryRouter.use(authenticate, requireRole('DELIVERY'));

deliveryRouter.get('/me', async (req, res, next) => {
  try {
    const partner = await delivery.getPartnerByUserId(req.user!.id);
    res.json({ partner, earnings: await delivery.getPartnerEarnings(req.user!.id) });
  } catch (e) { next(e); }
});

deliveryRouter.patch('/status', validate({
  body: z.object({ isOnline: z.boolean() }),
}), async (req, res, next) => {
  try { res.json({ partner: await delivery.setOnline(req.user!.id, req.body.isOnline) }); }
  catch (e) { next(e); }
});

deliveryRouter.post('/location', validate({
  body: z.object({ latitude: z.number(), longitude: z.number() }),
}), async (req, res, next) => {
  try {
    const p = await delivery.updateLocation(req.user!.id, req.body.latitude, req.body.longitude);
    res.json({ ok: true, lastSeenAt: p.lastSeenAt });
  } catch (e) { next(e); }
});

deliveryRouter.get('/available', async (req, res, next) => {
  try { res.json({ deliveries: await delivery.listAvailableDeliveries(req.user!.id) }); }
  catch (e) { next(e); }
});

deliveryRouter.get('/orders/:id', async (req, res, next) => {
  try {
    const order = await orderService.getOrderDetail(req.params.id);
    res.json({
      order,
      navigation: {
        pickup: mapsProvider.navigationUrl(order.vendor.latitude, order.vendor.longitude, order.vendor.name),
        drop: mapsProvider.navigationUrl(order.addressLatitude, order.addressLongitude, order.addressArea),
      },
    });
  } catch (e) { next(e); }
});

deliveryRouter.post('/:id/accept', async (req, res, next) => {
  try { res.json({ order: await delivery.acceptDelivery(req.user!.id, req.params.id) }); }
  catch (e) { next(e); }
});

deliveryRouter.patch('/:id/status', validate({
  body: z.object({
    status: z.enum(['PICKED_UP', 'ON_THE_WAY', 'DELIVERED']),
    codCollectedPaise: z.number().int().min(0).optional(),
  }),
}), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, codCollectedPaise } = req.body;
    const order =
      status === 'PICKED_UP' ? await delivery.markPickedUp(req.user!.id, id)
      : status === 'ON_THE_WAY' ? await delivery.markOnTheWay(req.user!.id, id)
      : await delivery.markDelivered(req.user!.id, id, codCollectedPaise);
    res.json({ order });
  } catch (e) { next(e); }
});

deliveryRouter.get('/history', async (req, res, next) => {
  try { res.json({ history: await delivery.listPartnerHistory(req.user!.id) }); } catch (e) { next(e); }
});

deliveryRouter.get('/earnings', async (req, res, next) => {
  try { res.json(await delivery.getPartnerEarnings(req.user!.id)); } catch (e) { next(e); }
});

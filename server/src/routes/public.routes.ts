import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { getSettings } from '../services/settings.service.js';
import { getActiveZones, resolveZone } from '../services/zone.service.js';
import * as catalog from '../services/catalog.service.js';
import { env } from '../config/env.js';

export const publicRouter = Router();

/** Everything the app needs at boot: branding, languages, live zones, fee display. */
publicRouter.get('/config', async (_req, res, next) => {
  try {
    const [settings, zones, cats] = await Promise.all([
      getSettings(), getActiveZones(), catalog.listCategories(),
    ]);
    res.json({
      brand: {
        name: settings.brandName,
        tagline: settings.brandTagline,
        primaryColor: settings.brandPrimaryColor,
      },
      languages: { supported: settings.supportedLocales, default: settings.defaultLocale },
      support: { phone: settings.supportPhone },
      fees: { platformFeePaise: settings.platformFeePaise, taxPct: settings.taxPct },
      serviceArea: zones.map((z) => ({
        id: z.id, name: z.name, city: z.city, district: z.district, state: z.state,
        latitude: z.latitude, longitude: z.longitude, radiusMeters: z.radiusMeters,
        deliveryFeePaise: z.deliveryFeePaise, minOrderPaise: z.minOrderPaise, etaMinutes: z.etaMinutes,
      })),
      categories: cats,
      mapsProvider: env.MAPS_PROVIDER,
    });
  } catch (e) { next(e); }
});

/** The service-area gate. Everything downstream needs the zoneId this returns. */
publicRouter.post('/location/resolve', validate({
  body: z.object({ latitude: z.number(), longitude: z.number() }),
}), async (req, res, next) => {
  try {
    const result = await resolveZone(req.body.latitude, req.body.longitude);
    res.json({
      serviceable: result.serviceable,
      zone: result.zone
        ? {
            id: result.zone.id, name: result.zone.name, city: result.zone.city,
            deliveryFeePaise: result.zone.deliveryFeePaise,
            minOrderPaise: result.zone.minOrderPaise, etaMinutes: result.zone.etaMinutes,
          }
        : null,
      message: result.serviceable
        ? `Delivering to ${result.zone!.name}`
        : 'Delivery is currently unavailable at this location.',
    });
  } catch (e) { next(e); }
});

publicRouter.get('/categories', async (_req, res, next) => {
  try { res.json({ categories: await catalog.listCategories() }); } catch (e) { next(e); }
});

publicRouter.get('/vendors', validate({
  query: z.object({
    zoneId: z.string().uuid(),
    categoryId: z.string().uuid().optional(),
    q: z.string().optional(),
    latitude: z.coerce.number().optional(),
    longitude: z.coerce.number().optional(),
    sort: z.enum(['distance', 'rating', 'fast']).optional(),
  }),
}), async (req, res, next) => {
  try { res.json({ vendors: await catalog.listVendors(req.query as never) }); } catch (e) { next(e); }
});

publicRouter.get('/vendors/:slug', async (req, res, next) => {
  try {
    const vendor = await catalog.getVendorBySlug(req.params.slug);
    const menu = await catalog.getVendorMenu(vendor.id);
    res.json({ vendor, menu });
  } catch (e) { next(e); }
});

publicRouter.get('/vendors/:slug/reviews', async (req, res, next) => {
  try {
    const vendor = await catalog.getVendorBySlug(req.params.slug);
    res.json({ reviews: await catalog.listVendorReviews(vendor.id) });
  } catch (e) { next(e); }
});

publicRouter.get('/items/:id', async (req, res, next) => {
  try { res.json({ item: await catalog.getFoodItem(req.params.id) }); } catch (e) { next(e); }
});

publicRouter.get('/search', validate({
  query: z.object({ q: z.string().min(1), zoneId: z.string().uuid() }),
}), async (req, res, next) => {
  try {
    res.json(await catalog.search({ q: String(req.query.q), zoneId: String(req.query.zoneId) }));
  } catch (e) { next(e); }
});

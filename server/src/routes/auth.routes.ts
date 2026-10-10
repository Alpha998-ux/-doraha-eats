import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimit.js';
import * as auth from '../services/auth.service.js';
import { db } from '../db/index.js';
import { deviceTokens } from '../db/schema.js';

export const authRouter = Router();

authRouter.post('/register', authLimiter, validate({
  body: z.object({
    fullName: z.string().min(2),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    email: z.string().email().optional(),
    phone: z.string().min(10).optional(),
    role: z.enum(['CUSTOMER', 'DELIVERY']).optional(),
    locale: z.enum(['en', 'hi', 'pa']).optional(),
  }),
}), async (req, res, next) => {
  try { res.status(201).json(await auth.register(req.body)); } catch (e) { next(e); }
});

authRouter.post('/login', authLimiter, validate({
  body: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    password: z.string().min(1),
  }),
}), async (req, res, next) => {
  try { res.json(await auth.login(req.body)); } catch (e) { next(e); }
});

authRouter.get('/me', authenticate, async (req, res, next) => {
  try { res.json({ user: await auth.me(req.user!.id) }); } catch (e) { next(e); }
});

authRouter.post('/otp/request', otpLimiter, validate({
  body: z.object({ phone: z.string().min(10) }),
}), async (req, res, next) => {
  try { res.json(await auth.requestOtp(req.body.phone)); } catch (e) { next(e); }
});

authRouter.post('/otp/verify', authLimiter, validate({
  body: z.object({ phone: z.string().min(10), code: z.string().min(4), fullName: z.string().optional() }),
}), async (req, res, next) => {
  try { res.json(await auth.verifyOtp(req.body.phone, req.body.code, req.body.fullName)); } catch (e) { next(e); }
});

authRouter.post('/google', authLimiter, validate({
  body: z.object({ idToken: z.string().min(1) }),
}), async (req, res, next) => {
  try { res.json(await auth.googleAuth(req.body.idToken)); } catch (e) { next(e); }
});

authRouter.post('/device-token', authenticate, validate({
  body: z.object({ token: z.string().min(4), platform: z.enum(['android', 'ios', 'web']) }),
}), async (req, res, next) => {
  try {
    await db.insert(deviceTokens)
      .values({ userId: req.user!.id, token: req.body.token, platform: req.body.platform })
      .onConflictDoNothing();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const disabled = env.NODE_ENV === 'test';

export const generalLimiter = rateLimit({
  windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false, skip: () => disabled,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false, skip: () => disabled,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' } },
});

export const otpLimiter = rateLimit({
  windowMs: 15 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: false, skip: () => disabled,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many OTP requests. Please wait a few minutes.' } },
});

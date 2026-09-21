import 'dotenv/config';
import { z } from 'zod';

const bool = (d: boolean) =>
  z.string().optional().transform((v) => (v === undefined ? d : v === 'true'));

const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGINS: z.string().default('*'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  DEMO_PASSWORD: z.string().default('Doraha@123'),
  SEED_DEMO_DATA: bool(true),
  PAYMENT_PROVIDER: z.enum(['mock', 'razorpay']).default('mock'),
  SMS_PROVIDER: z.enum(['console', 'msg91']).default('console'),
  PUSH_PROVIDER: z.enum(['inapp', 'expo', 'fcm']).default('inapp'),
  STORAGE_PROVIDER: z.enum(['local', 's3', 'cloudinary']).default('local'),
  MAPS_PROVIDER: z.enum(['manual', 'osm', 'google']).default('manual'),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  UPI_VPA: z.string().default('dorahaeats@demoupi'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const corsOrigins =
  env.CORS_ORIGINS === '*' ? true : env.CORS_ORIGINS.split(',').map((s) => s.trim());

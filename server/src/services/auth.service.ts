import { eq, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, customerProfiles, deliveryPartners, carts } from '../db/schema.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { signToken } from '../lib/jwt.js';
import { Errors } from '../lib/errors.js';
import { smsProvider } from '../adapters/sms/index.js';
import { otpCodes } from '../db/schema.js';

export type PublicUser = {
  id: string; role: string; fullName: string; email: string | null;
  phone: string | null; locale: string; status: string;
};

const toPublic = (u: typeof users.$inferSelect): PublicUser => ({
  id: u.id, role: u.role, fullName: u.fullName, email: u.email,
  phone: u.phone, locale: u.locale, status: u.status,
});

export async function register(input: {
  fullName: string; password: string; email?: string; phone?: string;
  role?: 'CUSTOMER' | 'DELIVERY'; locale?: string;
}) {
  if (!input.email && !input.phone) {
    throw Errors.badRequest('Please provide an email or a phone number.');
  }
  const conditions = [];
  if (input.email) conditions.push(eq(users.email, input.email));
  if (input.phone) conditions.push(eq(users.phone, input.phone));
  const [existing] = await db.select().from(users).where(or(...conditions)).limit(1);
  if (existing) throw Errors.conflict('An account with these details already exists.', 'ACCOUNT_EXISTS');

  const role = input.role ?? 'CUSTOMER';
  const [user] = await db.insert(users).values({
    role,
    fullName: input.fullName,
    email: input.email ?? null,
    phone: input.phone ?? null,
    passwordHash: await hashPassword(input.password),
    locale: input.locale ?? 'en',
    // Delivery partners must be approved by an admin before they can work.
    status: role === 'DELIVERY' ? 'PENDING' : 'ACTIVE',
  }).returning();

  if (role === 'CUSTOMER') {
    await db.insert(customerProfiles).values({ userId: user.id });
    await db.insert(carts).values({ userId: user.id });
  }
  if (role === 'DELIVERY') {
    await db.insert(deliveryPartners).values({ userId: user.id, status: 'PENDING' });
  }

  return { user: toPublic(user), token: signToken({ sub: user.id, role: user.role }) };
}

export async function login(input: { email?: string; phone?: string; password: string }) {
  const conditions = [];
  if (input.email) conditions.push(eq(users.email, input.email));
  if (input.phone) conditions.push(eq(users.phone, input.phone));
  if (!conditions.length) throw Errors.badRequest('Please provide an email or a phone number.');

  const [user] = await db.select().from(users).where(or(...conditions)).limit(1);
  // Same message for unknown account and wrong password — no account enumeration.
  if (!user?.passwordHash) throw Errors.unauthorized('Incorrect email or password.');
  if (!(await verifyPassword(input.password, user.passwordHash))) {
    throw Errors.unauthorized('Incorrect email or password.');
  }
  if (user.status === 'SUSPENDED') throw Errors.forbidden('This account has been suspended.');

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  return { user: toPublic(user), token: signToken({ sub: user.id, role: user.role }) };
}

export async function me(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw Errors.notFound('User');
  return toPublic(user);
}

/** OTP login. Dev SMS provider prints the code to the server console. */
export async function requestOtp(phone: string) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await hashPassword(code);
  await db.insert(otpCodes).values({
    phone, codeHash, expiresAt: new Date(Date.now() + 5 * 60_000),
  });
  await smsProvider.sendOtp(phone, code);
  return { sent: true, expiresInSeconds: 300 };
}

export async function verifyOtp(phone: string, code: string, fullName?: string) {
  const rows = await db.select().from(otpCodes)
    .where(eq(otpCodes.phone, phone))
    .orderBy(otpCodes.createdAt);
  const latest = rows.filter((r) => !r.consumed && r.expiresAt > new Date()).pop();
  if (!latest) throw Errors.badRequest('This code has expired. Please request a new one.', 'OTP_EXPIRED');
  if (latest.attempts >= 5) throw Errors.badRequest('Too many attempts. Please request a new code.', 'OTP_LOCKED');

  const ok = await verifyPassword(code, latest.codeHash);
  if (!ok) {
    await db.update(otpCodes).set({ attempts: latest.attempts + 1 }).where(eq(otpCodes.id, latest.id));
    throw Errors.badRequest('That code is not correct.', 'OTP_INVALID');
  }
  await db.update(otpCodes).set({ consumed: true }).where(eq(otpCodes.id, latest.id));

  let [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  if (!user) {
    [user] = await db.insert(users).values({
      role: 'CUSTOMER', phone, fullName: fullName ?? 'Doraha customer', status: 'ACTIVE',
    }).returning();
    await db.insert(customerProfiles).values({ userId: user.id });
    await db.insert(carts).values({ userId: user.id });
  }
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  return { user: toPublic(user), token: signToken({ sub: user.id, role: user.role }) };
}

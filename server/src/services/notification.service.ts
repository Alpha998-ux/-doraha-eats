import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { notifications, deviceTokens } from '../db/schema.js';
import { pushProvider } from '../adapters/push/index.js';

/**
 * MVP notifications are rows in PostgreSQL that the app polls. The push adapter
 * is called alongside, so switching to Expo/FCM later needs no call-site change.
 */
export async function notify(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(notifications).values({
    userId: input.userId, type: input.type, title: input.title,
    body: input.body, data: input.data ?? null,
  });
  const tokens = await db.select().from(deviceTokens).where(eq(deviceTokens.userId, input.userId));
  if (tokens.length) {
    await pushProvider.send(tokens.map((t) => t.token), {
      title: input.title, body: input.body, data: input.data,
    });
  }
}

export const ORDER_NOTIFICATIONS: Record<string, { title: string; body: string }> = {
  ACCEPTED:   { title: 'Order accepted',      body: 'Your order has been accepted by the stall.' },
  PREPARING:  { title: 'Preparing your food', body: 'Your food is being prepared now.' },
  READY:      { title: 'Food is ready',       body: 'Your food is ready and waiting for pickup.' },
  ASSIGNED:   { title: 'Delivery partner assigned', body: 'A delivery partner is heading to the stall.' },
  PICKED_UP:  { title: 'Order picked up',     body: 'Your delivery partner has picked up your order.' },
  ON_THE_WAY: { title: 'On the way',          body: 'Your order is on the way to you.' },
  DELIVERED:  { title: 'Order delivered',     body: 'Your order has been delivered. Enjoy!' },
  CANCELLED:  { title: 'Order cancelled',     body: 'Your order has been cancelled.' },
};

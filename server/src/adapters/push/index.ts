import { env } from '../../config/env.js';

export type PushMessage = { title: string; body: string; data?: Record<string, unknown> };

export interface PushProvider {
  send(tokens: string[], message: PushMessage): Promise<void>;
}

/**
 * MVP: notifications live in PostgreSQL and the app polls them.
 * Swap for Expo/FCM later — notificationService already writes the DB row either way.
 */
const inAppProvider: PushProvider = {
  async send(tokens, message) {
    if (tokens.length) console.log(`[push:inapp] ${tokens.length} device(s): ${message.title}`);
  },
};

export const pushProvider: PushProvider = env.PUSH_PROVIDER === 'inapp' ? inAppProvider : inAppProvider;

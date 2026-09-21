import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { settings } from '../db/schema.js';

/**
 * Admin-configurable business rules. NOTHING here may be hard-coded in a UI
 * component or a route handler — read it through getSettings().
 */
export type PlatformSettings = {
  brandName: string;
  brandTagline: string;
  brandPrimaryColor: string;
  platformFeePaise: number;
  commissionPct: number;
  taxPct: number;
  riderPayoutPaise: number;
  cancelWindowSeconds: number;
  defaultLocale: string;
  supportedLocales: string[];
  supportPhone: string;
};

export const DEFAULT_SETTINGS: PlatformSettings = {
  brandName: 'Doraha Eats',
  brandTagline: 'Doraha da apna food delivery.',
  brandPrimaryColor: '#E8552D',
  platformFeePaise: 500,
  commissionPct: 12.5,
  taxPct: 5,
  riderPayoutPaise: 2500,
  cancelWindowSeconds: 120,
  defaultLocale: 'en',
  supportedLocales: ['en', 'hi', 'pa'],
  supportPhone: '+911234567890',
};

const KEY = 'platform';
let cache: PlatformSettings | null = null;

export async function getSettings(): Promise<PlatformSettings> {
  if (cache) return cache;
  const [row] = await db.select().from(settings).where(eq(settings.key, KEY)).limit(1);
  cache = row ? { ...DEFAULT_SETTINGS, ...(row.value as Partial<PlatformSettings>) } : DEFAULT_SETTINGS;
  return cache;
}

export async function updateSettings(patch: Partial<PlatformSettings>): Promise<PlatformSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await db
    .insert(settings)
    .values({ key: KEY, value: next })
    .onConflictDoUpdate({ target: settings.key, set: { value: next, updatedAt: new Date() } });
  cache = next;
  return next;
}

export function invalidateSettingsCache() { cache = null; }

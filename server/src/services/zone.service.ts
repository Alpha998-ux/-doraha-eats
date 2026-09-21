import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { deliveryZones } from '../db/schema.js';
import { distanceMeters } from '../lib/geo.js';

export type Zone = typeof deliveryZones.$inferSelect;

/**
 * The service-area gate. A location is serviceable only if it falls inside an
 * ACTIVE zone. No radius is hard-coded — every zone is admin-configured, so a
 * new town is a row in this table, not a code change.
 */
export async function resolveZone(
  latitude: number,
  longitude: number,
): Promise<{ serviceable: boolean; zone: Zone | null; distanceMeters: number | null }> {
  const active = await db.select().from(deliveryZones).where(eq(deliveryZones.isActive, true));

  const matches = active
    .map((z) => ({ zone: z, d: distanceMeters(latitude, longitude, z.latitude, z.longitude) }))
    .filter((m) => m.d <= m.zone.radiusMeters)
    // highest priority wins an overlap; nearest centre breaks a priority tie
    .sort((a, b) => b.zone.priority - a.zone.priority || a.d - b.d);

  if (!matches.length) return { serviceable: false, zone: null, distanceMeters: null };
  return { serviceable: true, zone: matches[0].zone, distanceMeters: matches[0].d };
}

export async function getZoneById(id: string): Promise<Zone | null> {
  const [z] = await db.select().from(deliveryZones).where(eq(deliveryZones.id, id)).limit(1);
  return z ?? null;
}

export async function getActiveZones(): Promise<Zone[]> {
  return db
    .select()
    .from(deliveryZones)
    .where(and(eq(deliveryZones.isActive, true)));
}

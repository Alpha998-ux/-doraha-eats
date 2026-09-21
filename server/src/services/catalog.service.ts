import { and, asc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { categories, foodItems, vendorHours, vendors, reviews, users } from '../db/schema.js';
import { Errors } from '../lib/errors.js';
import { distanceMeters } from '../lib/geo.js';
import { isVendorOpen, nextOpeningLabel } from './vendorHours.service.js';
import { getZoneById } from './zone.service.js';

export async function listCategories() {
  return db.select().from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.sortOrder));
}

export async function listVendors(input: {
  zoneId: string; categoryId?: string; q?: string;
  latitude?: number; longitude?: number; sort?: 'distance' | 'rating' | 'fast';
}) {
  const zone = await getZoneById(input.zoneId);
  if (!zone || !zone.isActive) throw Errors.outOfZone();

  const rows = await db.query.vendors.findMany({
    where: and(eq(vendors.zoneId, input.zoneId), eq(vendors.status, 'ACTIVE')),
    with: { hours: true, categories: true },
  });

  let list = rows;
  if (input.categoryId) {
    list = list.filter((v) => v.categories.some((c) => c.categoryId === input.categoryId));
  }
  if (input.q) {
    const q = input.q.toLowerCase();
    list = list.filter((v) => v.name.toLowerCase().includes(q));
  }

  const lat = input.latitude ?? zone.latitude;
  const lng = input.longitude ?? zone.longitude;

  const mapped = list.map((v) => {
    const open = isVendorOpen(v.isOpenManual, v.hours);
    return {
      id: v.id, name: v.name, slug: v.slug, about: v.about,
      logoUrl: v.logoUrl, coverUrl: v.coverUrl,
      ratingAvg: v.ratingAvg, ratingCount: v.ratingCount,
      prepTimeMinutes: v.prepTimeMinutes,
      addressLine: v.addressLine,
      isDemo: v.isDemo,
      isOpen: open,
      nextOpening: open ? null : nextOpeningLabel(v.hours),
      distanceMeters: distanceMeters(lat, lng, v.latitude, v.longitude),
      deliveryFeePaise: zone.deliveryFeePaise,
      etaMinutes: zone.etaMinutes + v.prepTimeMinutes,
      categoryIds: v.categories.map((c) => c.categoryId),
    };
  });

  const sorter = {
    rating: (a: typeof mapped[0], b: typeof mapped[0]) => b.ratingAvg - a.ratingAvg,
    fast: (a: typeof mapped[0], b: typeof mapped[0]) => a.etaMinutes - b.etaMinutes,
    distance: (a: typeof mapped[0], b: typeof mapped[0]) => a.distanceMeters - b.distanceMeters,
  }[input.sort ?? 'distance'];

  // Open stalls always rank above closed ones, whatever the sort.
  return mapped.sort((a, b) => Number(b.isOpen) - Number(a.isOpen) || sorter(a, b));
}

export async function getVendorBySlug(slug: string) {
  const vendor = await db.query.vendors.findFirst({
    where: eq(vendors.slug, slug),
    with: { hours: true, zone: true, categories: { with: { category: true } } },
  });
  if (!vendor || vendor.status !== 'ACTIVE') throw Errors.notFound('Stall');

  const open = isVendorOpen(vendor.isOpenManual, vendor.hours);
  return {
    ...vendor,
    isOpen: open,
    nextOpening: open ? null : nextOpeningLabel(vendor.hours),
    deliveryFeePaise: vendor.zone.deliveryFeePaise,
    etaMinutes: vendor.zone.etaMinutes + vendor.prepTimeMinutes,
  };
}

export async function getVendorMenu(vendorId: string) {
  const sections = await db.query.menuSections.findMany({
    where: (t, { eq: e }) => e(t.vendorId, vendorId),
    orderBy: (t, { asc: a }) => [a(t.sortOrder)],
    with: {
      foodItems: {
        orderBy: (t, { asc: a }) => [a(t.sortOrder)],
        with: { customizationGroups: { with: { options: true } } },
      },
    },
  });
  return sections;
}

export async function getFoodItem(id: string) {
  const item = await db.query.foodItems.findFirst({
    where: eq(foodItems.id, id),
    with: { customizationGroups: { with: { options: true } }, vendor: true },
  });
  if (!item) throw Errors.notFound('Food item');
  return item;
}

/** Real DB search across stall names, dish names and categories. */
export async function search(input: { q: string; zoneId: string }) {
  const term = `%${input.q}%`;

  const matchedVendors = await db.query.vendors.findMany({
    where: and(eq(vendors.zoneId, input.zoneId), eq(vendors.status, 'ACTIVE'), ilike(vendors.name, term)),
    with: { hours: true },
    limit: 20,
  });

  const matchedItems = await db
    .select({ item: foodItems, vendor: vendors })
    .from(foodItems)
    .innerJoin(vendors, eq(foodItems.vendorId, vendors.id))
    .leftJoin(categories, eq(foodItems.categoryId, categories.id))
    .where(and(
      eq(vendors.zoneId, input.zoneId),
      eq(vendors.status, 'ACTIVE'),
      eq(foodItems.isAvailable, true),
      or(ilike(foodItems.name, term), ilike(foodItems.description, term), ilike(categories.name, term)),
    ))
    .limit(40);

  // A stall whose dishes match should also appear in the stall list.
  const viaItems = new Map<string, typeof matchedItems[0]['vendor']>();
  for (const r of matchedItems) if (!viaItems.has(r.vendor.id)) viaItems.set(r.vendor.id, r.vendor);

  const vendorIds = new Set(matchedVendors.map((v) => v.id));
  const extra = [...viaItems.values()].filter((v) => !vendorIds.has(v.id));

  return {
    vendors: [
      ...matchedVendors.map((v) => ({
        id: v.id, name: v.name, slug: v.slug, logoUrl: v.logoUrl, coverUrl: v.coverUrl,
        ratingAvg: v.ratingAvg, ratingCount: v.ratingCount,
        isOpen: isVendorOpen(v.isOpenManual, v.hours),
      })),
      ...extra.map((v) => ({
        id: v.id, name: v.name, slug: v.slug, logoUrl: v.logoUrl, coverUrl: v.coverUrl,
        ratingAvg: v.ratingAvg, ratingCount: v.ratingCount, isOpen: true,
      })),
    ],
    items: matchedItems.map((r) => ({
      id: r.item.id, name: r.item.name, description: r.item.description,
      pricePaise: r.item.pricePaise, imageUrl: r.item.imageUrl, isVeg: r.item.isVeg,
      vendor: { id: r.vendor.id, name: r.vendor.name, slug: r.vendor.slug },
    })),
  };
}

export async function listVendorReviews(vendorId: string) {
  return db
    .select({
      id: reviews.id, rating: reviews.rating, comment: reviews.comment,
      createdAt: reviews.createdAt, customerName: users.fullName,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.customerId, users.id))
    .where(and(eq(reviews.vendorId, vendorId), eq(reviews.isHidden, false)))
    .orderBy(sql`${reviews.createdAt} desc`)
    .limit(50);
}

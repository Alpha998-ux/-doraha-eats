import { api } from '../../lib/api';

export type AppConfig = {
  brand: { name: string; tagline: string; primaryColor: string };
  languages: { supported: string[]; default: string };
  serviceArea: Array<{
    id: string; name: string; city: string; latitude: number; longitude: number;
    radiusMeters: number; deliveryFeePaise: number; minOrderPaise: number; etaMinutes: number;
  }>;
  categories: Array<{ id: string; slug: string; name: string; icon: string | null }>;
};

export const getConfig = () => api<AppConfig>('/config');

export const resolveLocation = (latitude: number, longitude: number) =>
  api<{ serviceable: boolean; zone: { id: string; name: string; deliveryFeePaise: number; minOrderPaise: number; etaMinutes: number } | null; message: string }>(
    '/location/resolve', { method: 'POST', body: { latitude, longitude } },
  );

export type VendorSummary = {
  id: string; name: string; slug: string; logoUrl: string | null; coverUrl: string | null;
  ratingAvg: number; ratingCount: number; prepTimeMinutes: number; isOpen: boolean;
  nextOpening: string | null; distanceMeters: number; deliveryFeePaise: number; etaMinutes: number;
  categoryIds: string[]; isDemo: boolean;
};

export const listVendors = (zoneId: string, opts?: { categoryId?: string; q?: string; sort?: string }) => {
  const params = new URLSearchParams({ zoneId, ...(opts?.categoryId ? { categoryId: opts.categoryId } : {}), ...(opts?.q ? { q: opts.q } : {}), ...(opts?.sort ? { sort: opts.sort } : {}) });
  return api<{ vendors: VendorSummary[] }>(`/vendors?${params.toString()}`);
};

export type CustomizationOption = { id: string; name: string; priceDeltaPaise: number; isAvailable: boolean; isDefault: boolean };
export type CustomizationGroup = { id: string; name: string; minSelect: number; maxSelect: number; options: CustomizationOption[] };
export type FoodItem = {
  id: string; name: string; description: string | null; pricePaise: number; imageUrl: string | null;
  isVeg: boolean; isAvailable: boolean; customizationGroups: CustomizationGroup[];
};
export type MenuSection = { id: string; name: string; foodItems: FoodItem[] };

export type VendorDetail = {
  id: string; name: string; slug: string; about: string | null; addressLine: string;
  logoUrl: string | null; coverUrl: string | null; ratingAvg: number; ratingCount: number;
  isOpen: boolean; nextOpening: string | null; deliveryFeePaise: number; etaMinutes: number;
  hours: Array<{ dayOfWeek: number; opensAt: string; closesAt: string }>;
};

export const getVendor = (slug: string) => api<{ vendor: VendorDetail; menu: MenuSection[] }>(`/vendors/${slug}`);

export const search = (q: string, zoneId: string) =>
  api<{ vendors: VendorSummary[]; items: Array<{ id: string; name: string; pricePaise: number; imageUrl: string | null; isVeg: boolean; vendor: { id: string; name: string; slug: string } }> }>(
    `/search?q=${encodeURIComponent(q)}&zoneId=${zoneId}`,
  );

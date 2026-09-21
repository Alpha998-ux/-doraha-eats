import { describe, it, expect } from 'vitest';
import { computeOrder, buildLine } from '../src/services/pricing.service.js';
import { canTransition, actorCanSet, isTerminal, CUSTOMER_TIMELINE } from '../src/services/orderStatus.js';
import { distanceMeters } from '../src/lib/geo.js';
import { isVendorOpen, nextOpeningLabel } from '../src/services/vendorHours.service.js';
import { DEFAULT_SETTINGS } from '../src/services/settings.service.js';
import { rupeesToPaise, pctOf } from '../src/lib/money.js';

const zone = { deliveryFeePaise: 2000, minOrderPaise: 9900, etaMinutes: 30 };
const settings = { ...DEFAULT_SETTINGS, platformFeePaise: 500, taxPct: 5, commissionPct: 12.5 };

const hour = (dayOfWeek: number, opensAt: string, closesAt: string) =>
  ({ id: `${dayOfWeek}`, vendorId: 'v', dayOfWeek, opensAt, closesAt });

describe('money', () => {
  it('converts rupees to integer paise', () => {
    expect(rupeesToPaise(49)).toBe(4900);
    expect(rupeesToPaise(49.5)).toBe(4950);
  });
  it('rounds percentages to the nearest paisa', () => {
    expect(pctOf(4999, 5)).toBe(250);
  });
});

describe('cart line pricing', () => {
  it('adds customization deltas to the base price', () => {
    const line = buildLine({
      foodItemId: 'f1', name: 'Classic Veg Burger', basePricePaise: 4900,
      optionDeltas: [2500, 2000], quantity: 2,
    });
    expect(line.unitPricePaise).toBe(9400);
    expect(line.lineTotalPaise).toBe(18800);
  });

  it('handles an item with no customizations', () => {
    const line = buildLine({ foodItemId: 'f2', name: 'Cold Drink', basePricePaise: 2500, optionDeltas: [], quantity: 3 });
    expect(line.unitPricePaise).toBe(2500);
    expect(line.lineTotalPaise).toBe(7500);
  });
});

describe('order totals', () => {
  const lines = [
    buildLine({ foodItemId: 'a', name: 'A', basePricePaise: 10000, optionDeltas: [], quantity: 1 }),
    buildLine({ foodItemId: 'b', name: 'B', basePricePaise: 5000, optionDeltas: [1000], quantity: 2 }),
  ];

  it('computes subtotal, fees, tax and total consistently', () => {
    const r = computeOrder({ lines, zone, settings });
    expect(r.subtotalPaise).toBe(10000 + 12000);
    expect(r.deliveryFeePaise).toBe(2000);
    expect(r.platformFeePaise).toBe(500);
    expect(r.taxPaise).toBe(pctOf(22000, 5));
    expect(r.totalPaise).toBe(22000 + 2000 + 500 + r.taxPaise);
  });

  it('taxes food only, never the fees', () => {
    const r = computeOrder({ lines, zone, settings });
    expect(r.taxPaise).toBe(1100);            // 5% of 22000, not of the total
  });

  it('applies a discount before tax and never below zero', () => {
    const r = computeOrder({ lines, zone, settings, discountPaise: 5000 });
    expect(r.discountPaise).toBe(5000);
    expect(r.taxPaise).toBe(pctOf(17000, 5));
    expect(r.totalPaise).toBe(17000 + 2000 + 500 + r.taxPaise);
  });

  it('caps a discount at the subtotal', () => {
    const r = computeOrder({ lines, zone, settings, discountPaise: 999999 });
    expect(r.discountPaise).toBe(22000);
    expect(r.totalPaise).toBe(2000 + 500);
  });

  it('prefers a vendor-specific commission over the platform default', () => {
    const def = computeOrder({ lines, zone, settings });
    const custom = computeOrder({ lines, zone, settings, vendorCommissionPct: 20 });
    expect(def.commissionPaise).toBe(pctOf(22000, 12.5));
    expect(custom.commissionPaise).toBe(pctOf(22000, 20));
  });

  it('returns integers only — no floating point money', () => {
    const r = computeOrder({ lines, zone, settings });
    for (const v of [r.subtotalPaise, r.taxPaise, r.totalPaise, r.commissionPaise]) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('reflects an admin fee change without any code change', () => {
    const cheap = computeOrder({ lines, zone, settings: { ...settings, platformFeePaise: 0 } });
    const pricey = computeOrder({ lines, zone, settings: { ...settings, platformFeePaise: 1500 } });
    expect(pricey.totalPaise - cheap.totalPaise).toBe(1500);
  });
});

describe('order status machine', () => {
  it('allows the happy path end to end', () => {
    for (let i = 0; i < CUSTOMER_TIMELINE.length - 1; i++) {
      expect(canTransition(CUSTOMER_TIMELINE[i], CUSTOMER_TIMELINE[i + 1])).toBe(true);
    }
  });

  it('refuses skipping a step', () => {
    expect(canTransition('PLACED', 'READY')).toBe(false);
    expect(canTransition('ACCEPTED', 'DELIVERED')).toBe(false);
    expect(canTransition('READY', 'PICKED_UP')).toBe(false);
  });

  it('refuses going backwards', () => {
    expect(canTransition('PREPARING', 'ACCEPTED')).toBe(false);
    expect(canTransition('DELIVERED', 'ON_THE_WAY')).toBe(false);
  });

  it('treats DELIVERED and CANCELLED as terminal', () => {
    expect(isTerminal('DELIVERED')).toBe(true);
    expect(isTerminal('CANCELLED')).toBe(true);
    expect(isTerminal('READY')).toBe(false);
  });

  it('allows cancellation up to ON_THE_WAY but not after', () => {
    expect(canTransition('PLACED', 'CANCELLED')).toBe(true);
    expect(canTransition('PICKED_UP', 'CANCELLED')).toBe(true);
    expect(canTransition('ON_THE_WAY', 'CANCELLED')).toBe(false);
  });

  it('enforces who may set each status', () => {
    expect(actorCanSet('VENDOR', 'ACCEPTED')).toBe(true);
    expect(actorCanSet('CUSTOMER', 'ACCEPTED')).toBe(false);
    expect(actorCanSet('DELIVERY', 'PICKED_UP')).toBe(true);
    expect(actorCanSet('VENDOR', 'DELIVERED')).toBe(false);
    expect(actorCanSet('CUSTOMER', 'CANCELLED')).toBe(true);
    expect(actorCanSet('ADMIN', 'READY')).toBe(true);
  });
});

describe('delivery zone validation', () => {
  const centre = { lat: 30.7996, lng: 76.0236 };   // Doraha

  it('measures real distances', () => {
    expect(distanceMeters(centre.lat, centre.lng, centre.lat, centre.lng)).toBe(0);
    const d = distanceMeters(centre.lat, centre.lng, centre.lat + 0.009, centre.lng);
    expect(d).toBeGreaterThan(900);
    expect(d).toBeLessThan(1100);
  });

  it('places a nearby address inside a 2.5km zone', () => {
    const d = distanceMeters(centre.lat, centre.lng, centre.lat + 0.005, centre.lng + 0.005);
    expect(d).toBeLessThan(2500);
  });

  it('places Ludhiana city outside a Doraha zone — the district is NOT the service area', () => {
    const ludhiana = { lat: 30.9010, lng: 75.8573 };
    const d = distanceMeters(centre.lat, centre.lng, ludhiana.lat, ludhiana.lng);
    expect(d).toBeGreaterThan(2500);
  });

  it('places Delhi far outside', () => {
    expect(distanceMeters(centre.lat, centre.lng, 28.6139, 77.2090)).toBeGreaterThan(200_000);
  });
});

describe('vendor opening hours', () => {
  const monday10am = new Date('2026-09-14T10:30:00');   // a Monday
  const monday2am = new Date('2026-09-14T02:00:00');

  it('is closed when the manual switch is off, whatever the hours say', () => {
    expect(isVendorOpen(false, [hour(1, '09:00', '23:00')], monday10am)).toBe(false);
  });

  it('is open inside the window', () => {
    expect(isVendorOpen(true, [hour(1, '09:00', '23:00')], monday10am)).toBe(true);
  });

  it('is closed outside the window', () => {
    expect(isVendorOpen(true, [hour(1, '18:00', '23:00')], monday10am)).toBe(false);
  });

  it('closes exactly at the closing minute of an overnight window', () => {
    expect(isVendorOpen(true, [hour(0, '20:00', '03:00')], new Date('2026-09-14T03:00:00'))).toBe(false);
  });

  it('handles a window that crosses midnight', () => {
    // Sunday 20:00 -> 03:00 still covers Monday 02:00
    expect(isVendorOpen(true, [hour(0, '20:00', '03:00')], monday2am)).toBe(true);
  });

  it('treats a stall with no configured hours as open', () => {
    expect(isVendorOpen(true, [], monday10am)).toBe(true);
  });

  it('reports the next opening time when closed', () => {
    expect(nextOpeningLabel([hour(1, '18:00', '23:00')], monday10am)).toBe('Opens at 18:00');
  });
});

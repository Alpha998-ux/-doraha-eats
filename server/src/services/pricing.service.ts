import { pctOf } from '../lib/money.js';
import type { PlatformSettings } from './settings.service.js';
import type { Zone } from './zone.service.js';

export type PriceLine = {
  foodItemId: string;
  name: string;
  basePricePaise: number;
  optionsDeltaPaise: number;
  unitPricePaise: number;
  quantity: number;
  lineTotalPaise: number;
};

export type PriceBreakdown = {
  lines: PriceLine[];
  subtotalPaise: number;
  deliveryFeePaise: number;
  platformFeePaise: number;
  taxPaise: number;
  discountPaise: number;
  totalPaise: number;
  commissionPaise: number;
  minOrderPaise: number;
  etaMinutes: number;
};

/**
 * Single source of truth for order money. The mobile app NEVER computes totals;
 * it renders what this returns. Tax applies to food only, not to fees.
 */
export function computeOrder(input: {
  lines: PriceLine[];
  zone: Pick<Zone, 'deliveryFeePaise' | 'minOrderPaise' | 'etaMinutes'>;
  settings: PlatformSettings;
  vendorCommissionPct?: number | null;
  discountPaise?: number;
}): PriceBreakdown {
  const { lines, zone, settings } = input;

  const subtotalPaise = lines.reduce((sum, l) => sum + l.lineTotalPaise, 0);
  const discountPaise = Math.min(input.discountPaise ?? 0, subtotalPaise);
  const taxable = subtotalPaise - discountPaise;

  const deliveryFeePaise = zone.deliveryFeePaise;
  const platformFeePaise = settings.platformFeePaise;
  const taxPaise = pctOf(taxable, settings.taxPct);
  const totalPaise = taxable + deliveryFeePaise + platformFeePaise + taxPaise;

  const commissionPct = input.vendorCommissionPct ?? settings.commissionPct;
  const commissionPaise = pctOf(taxable, commissionPct);

  return {
    lines, subtotalPaise, deliveryFeePaise, platformFeePaise, taxPaise,
    discountPaise, totalPaise, commissionPaise,
    minOrderPaise: zone.minOrderPaise, etaMinutes: zone.etaMinutes,
  };
}

export function buildLine(input: {
  foodItemId: string; name: string; basePricePaise: number;
  optionDeltas: number[]; quantity: number;
}): PriceLine {
  const optionsDeltaPaise = input.optionDeltas.reduce((a, b) => a + b, 0);
  const unitPricePaise = input.basePricePaise + optionsDeltaPaise;
  return {
    foodItemId: input.foodItemId,
    name: input.name,
    basePricePaise: input.basePricePaise,
    optionsDeltaPaise,
    unitPricePaise,
    quantity: input.quantity,
    lineTotalPaise: unitPricePaise * input.quantity,
  };
}

import { env } from '../../config/env.js';

export type GeocodeResult = { latitude: number; longitude: number; formatted: string };

export interface MapsProvider {
  readonly requiresApiKey: boolean;
  geocode(query: string): Promise<GeocodeResult | null>;
  navigationUrl(lat: number, lng: number, label?: string): string;
}

/**
 * Manual provider — the MVP default. The customer picks their area and types the
 * address; no paid API is needed to run the app. Navigation opens whatever map
 * app the phone already has via a geo: URI.
 */
const manualProvider: MapsProvider = {
  requiresApiKey: false,
  async geocode() { return null; },
  navigationUrl(lat, lng, label) {
    return `geo:${lat},${lng}?q=${lat},${lng}${label ? `(${encodeURIComponent(label)})` : ''}`;
  },
};

export const mapsProvider: MapsProvider =
  env.MAPS_PROVIDER === 'manual' ? manualProvider : manualProvider;

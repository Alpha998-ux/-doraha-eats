import type { vendorHours } from '../db/schema.js';

type Hour = typeof vendorHours.$inferSelect;

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * A stall is open when its manual switch is on AND the current time falls inside
 * today's hours. Windows that cross midnight (e.g. 18:00-02:00) are handled.
 */
export function isVendorOpen(
  isOpenManual: boolean,
  hours: Hour[],
  now: Date = new Date(),
): boolean {
  if (!isOpenManual) return false;
  if (!hours.length) return true; // no hours configured yet → treat as always open

  const day = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();

  const windows = hours.filter((h) => h.dayOfWeek === day);
  const yesterdayWindows = hours.filter((h) => h.dayOfWeek === (day + 6) % 7);

  for (const w of windows) {
    const open = toMinutes(w.opensAt);
    const close = toMinutes(w.closesAt);
    if (close > open ? mins >= open && mins < close : mins >= open) return true;
  }
  // spill-over from yesterday's overnight window
  for (const w of yesterdayWindows) {
    const open = toMinutes(w.opensAt);
    const close = toMinutes(w.closesAt);
    if (close <= open && mins < close) return true;
  }
  return false;
}

export function nextOpeningLabel(hours: Hour[], now: Date = new Date()): string | null {
  if (!hours.length) return null;
  const day = now.getDay();
  for (let i = 0; i < 7; i++) {
    const d = (day + i) % 7;
    const todays = hours.filter((h) => h.dayOfWeek === d).sort((a, b) => a.opensAt.localeCompare(b.opensAt));
    for (const w of todays) {
      if (i > 0 || toMinutes(w.opensAt) > now.getHours() * 60 + now.getMinutes()) {
        return i === 0 ? `Opens at ${w.opensAt}` : `Opens ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]} ${w.opensAt}`;
      }
    }
  }
  return null;
}

/** Human-readable order code shown to customer, vendor and rider alike. */
export function generateOrderCode(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  const t = Date.now().toString(36).slice(-3).toUpperCase();
  return `DE-${t}${n}`;
}

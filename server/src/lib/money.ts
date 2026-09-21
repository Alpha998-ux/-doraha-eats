/** All money is integer paise. These are the only conversions in the codebase. */
export const rupeesToPaise = (r: number) => Math.round(r * 100);
export const paiseToRupees = (p: number) => p / 100;
export const formatPaise = (p: number) =>
  `Rs ${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Percentage of an amount, rounded to the nearest paisa. */
export const pctOf = (paise: number, pct: number) => Math.round((paise * pct) / 100);

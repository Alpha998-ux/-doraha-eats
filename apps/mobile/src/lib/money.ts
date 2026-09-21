/** All money from the backend is integer paise. The app never computes totals itself. */
export const formatPaise = (p: number) =>
  `Rs ${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

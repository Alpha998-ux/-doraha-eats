/**
 * Doraha Eats design tokens. Original identity — warm and local,
 * deliberately not Zomato red or Swiggy orange.
 */
export const colors = {
  primary: '#E8552D',
  primaryDark: '#C33F1C',
  accent: '#F2B705',
  success: '#2E9E5B',
  danger: '#D33F3F',
  warning: '#D98E04',
  surface: '#FFFFFF',
  background: '#FAF7F2',
  text: '#1C1917',
  textMuted: '#6F6A66',
  border: '#EBE5DD',
  overlay: 'rgba(28,25,23,0.5)',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 };

export const typography = {
  h1: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  h2: { fontSize: 20, fontWeight: '700' as const, lineHeight: 28 },
  h3: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodyBold: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  price: { fontSize: 16, fontWeight: '700' as const, lineHeight: 22 },
};

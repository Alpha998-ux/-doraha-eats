import { api } from '../../lib/api';
import type { CartView } from '../../store/cartStore';

export const getCart = () => api<{ cart: CartView }>('/cart');

export const addToCart = (input: { foodItemId: string; quantity: number; optionIds?: string[]; instructions?: string }) =>
  api<{ cart: CartView }>('/cart/items', { method: 'POST', body: input });

export const updateCartItem = (cartItemId: string, quantity: number) =>
  api<{ cart: CartView }>(`/cart/items/${cartItemId}`, { method: 'PATCH', body: { quantity } });

export const removeCartItem = (cartItemId: string) =>
  api<{ cart: CartView }>(`/cart/items/${cartItemId}`, { method: 'DELETE' });

export const clearCart = () => api<{ cart: CartView }>('/cart', { method: 'DELETE' });

export type Blocker = { code: string; message: string };
export type PriceBreakdown = {
  subtotalPaise: number; deliveryFeePaise: number; platformFeePaise: number;
  taxPaise: number; discountPaise: number; totalPaise: number; minOrderPaise: number; etaMinutes: number;
};
export type Quote = { cart: CartView; zone: { id: string; name: string } | null; breakdown: PriceBreakdown; blockers: Blocker[]; canPlaceOrder: boolean };

export const quoteCart = (addressId: string) =>
  api<Quote>('/cart/quote', { method: 'POST', body: { addressId } });

import { create } from 'zustand';

/**
 * The cart's SOURCE OF TRUTH lives in PostgreSQL (see src/features/cart).
 * This store only mirrors the server response so screens don't all refetch —
 * quantities, prices and totals are never computed on the client.
 */
export type CartItemView = {
  id: string; foodItemId: string; name: string; imageUrl: string | null; isVeg: boolean;
  unitPricePaise: number; quantity: number; lineTotalPaise: number;
  instructions: string | null; isAvailable: boolean;
  options: Array<{ id: string; name: string; priceDeltaPaise: number }>;
};

export type CartView = {
  id: string;
  vendor: { id: string; name: string; slug: string; isOpen: boolean; prepTimeMinutes: number } | null;
  items: CartItemView[];
  subtotalPaise: number;
  itemCount: number;
};

type CartState = {
  cart: CartView | null;
  setCart: (c: CartView) => void;
};

export const useCartStore = create<CartState>((set) => ({
  cart: null,
  setCart: (cart) => set({ cart }),
}));

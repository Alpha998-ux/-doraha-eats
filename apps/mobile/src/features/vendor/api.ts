import { api } from '../../lib/api';
import type { OrderDetail, OrderStatus } from '../orders/api';

export type VendorProfile = {
  id: string; name: string; about: string | null; phone: string; addressLine: string;
  prepTimeMinutes: number; isOpenManual: boolean; status: string; isOpen: boolean;
};

export const getMyVendor = () => api<{ vendor: VendorProfile }>('/vendor/me');

export const setVendorOpen = (isOpenManual: boolean) =>
  api<{ vendor: VendorProfile }>('/vendor/me', { method: 'PATCH', body: { isOpenManual } });

export const listVendorOrders = (status?: OrderStatus) =>
  api<{ orders: OrderDetail[] }>(`/vendor/orders${status ? `?status=${status}` : ''}`);

export const acceptOrder = (id: string, prepTimeMinutes?: number) =>
  api<{ order: OrderDetail }>(`/vendor/orders/${id}/accept`, { method: 'POST', body: { prepTimeMinutes } });

export const rejectOrder = (id: string, reason: string) =>
  api<{ order: OrderDetail }>(`/vendor/orders/${id}/reject`, { method: 'POST', body: { reason } });

export const markPreparing = (id: string) => api<{ order: OrderDetail }>(`/vendor/orders/${id}/preparing`, { method: 'POST' });
export const markReady = (id: string) => api<{ order: OrderDetail }>(`/vendor/orders/${id}/ready`, { method: 'POST' });

export const getVendorEarnings = () => api<{
  allTime: { orders: number; grossPaise: number; commissionPaise: number; netPaise: number };
  today: { orders: number; grossPaise: number };
}>('/vendor/earnings');

export type MenuFoodItem = { id: string; name: string; pricePaise: number; isAvailable: boolean; isVeg: boolean };
export type MenuSectionAdmin = { id: string; name: string; foodItems: MenuFoodItem[] };
export const getVendorMenu = () => api<{ sections: MenuSectionAdmin[] }>('/vendor/menu');
export const setItemAvailability = (id: string, isAvailable: boolean) =>
  api(`/vendor/menu/items/${id}`, { method: 'PATCH', body: { isAvailable } });

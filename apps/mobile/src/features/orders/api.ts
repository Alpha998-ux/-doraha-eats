import { api } from '../../lib/api';

export type OrderStatus =
  | 'PLACED' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'ASSIGNED'
  | 'PICKED_UP' | 'ON_THE_WAY' | 'DELIVERED' | 'CANCELLED';

export type OrderDetail = {
  id: string; code: string; status: OrderStatus; statusLabel: string;
  totalPaise: number; subtotalPaise: number; deliveryFeePaise: number; platformFeePaise: number; taxPaise: number;
  paymentMethod: 'COD' | 'UPI'; paymentStatus: string; etaMinutes: number;
  addressLine: string; addressArea: string; contactPhone: string;
  cookingNote: string | null; placedAt: string;
  vendor: { id: string; name: string; slug: string; phone: string; latitude: number; longitude: number };
  items: Array<{ id: string; nameSnapshot: string; unitPricePaise: number; quantity: number;
    options: Array<{ nameSnapshot: string; priceDeltaPaise: number }> }>;
  events: Array<{ status: OrderStatus; createdAt: string; note: string | null }>;
  review: { id: string; rating: number } | null;
  deliveryPartner: { id: string; name: string; phone: string | null; latitude: number | null; longitude: number | null } | null;
  payment: { provider: string; status: string; raw?: { upiUri?: string; instructions?: string } } | null;
};

export const placeOrder = (input: { addressId: string; paymentMethod: 'COD' | 'UPI'; cookingNote?: string }) =>
  api<{ order: OrderDetail }>('/orders', { method: 'POST', body: input });

export const listMyOrders = () => api<{ orders: OrderDetail[] }>('/orders');

export const getOrder = (id: string) => api<{ order: OrderDetail }>(`/orders/${id}`);

export const cancelOrder = (id: string, reason?: string) =>
  api<{ order: OrderDetail }>(`/orders/${id}/cancel`, { method: 'POST', body: { reason } });

export const submitUpiRef = (id: string, utr: string) =>
  api<{ verified: boolean; order: OrderDetail }>(`/orders/${id}/payment/upi-ref`, { method: 'POST', body: { utr } });

export const submitReview = (id: string, input: { rating: number; deliveryRating?: number; comment?: string }) =>
  api(`/orders/${id}/review`, { method: 'POST', body: input });

export type Address = {
  id: string; label: string; area: string; line1: string; landmark: string | null;
  latitude: number; longitude: number; zoneId: string | null; isDefault: boolean;
};

export const listAddresses = () => api<{ addresses: Address[] }>('/addresses');

export const addAddress = (input: {
  label: 'HOME' | 'WORK' | 'OTHER'; area: string; line1: string; landmark?: string;
  latitude: number; longitude: number; isDefault?: boolean;
}) => api<{ address: Address; serviceable: boolean; message: string | null }>('/addresses', { method: 'POST', body: input });

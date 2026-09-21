import { api } from '../../lib/api';
import type { OrderDetail } from '../orders/api';

export type PartnerProfile = { id: string; isOnline: boolean; status: string; vehicle: string };

export const getMyPartner = () => api<{
  partner: PartnerProfile;
  earnings: { totalDeliveries: number; totalEarningsPaise: number; todayDeliveries: number; todayEarningsPaise: number };
}>('/delivery/me');

export const setOnline = (isOnline: boolean) =>
  api<{ partner: PartnerProfile }>('/delivery/status', { method: 'PATCH', body: { isOnline } });

export const updateMyLocation = (latitude: number, longitude: number) =>
  api('/delivery/location', { method: 'POST', body: { latitude, longitude } });

export type DeliveryJob = {
  orderId: string; code: string;
  vendor: { id: string; name: string; addressLine: string; latitude: number; longitude: number; phone: string };
  itemCount: number; totalPaise: number; paymentMethod: 'COD' | 'UPI'; codToCollectPaise: number;
  payoutPaise: number; dropArea: string; dropLine: string;
  pickupDistanceMeters: number | null; dropDistanceMeters: number;
};

export const listAvailableDeliveries = () => api<{ deliveries: DeliveryJob[] }>('/delivery/available');

export const acceptDelivery = (orderId: string) =>
  api<{ order: OrderDetail }>(`/delivery/${orderId}/accept`, { method: 'POST' });

export const setDeliveryStatus = (orderId: string, status: 'PICKED_UP' | 'ON_THE_WAY' | 'DELIVERED', codCollectedPaise?: number) =>
  api<{ order: OrderDetail }>(`/delivery/${orderId}/status`, { method: 'PATCH', body: { status, codCollectedPaise } });

export const getDeliveryOrder = (orderId: string) =>
  api<{ order: OrderDetail; navigation: { pickup: string; drop: string } }>(`/delivery/orders/${orderId}`);

export const listHistory = () => api<{ history: Array<{ assignmentId: string; state: string; payoutPaise: number; order: { code: string; status: string; totalPaise: number; area: string } }> }>('/delivery/history');

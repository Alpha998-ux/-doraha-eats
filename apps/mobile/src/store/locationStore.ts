import { create } from 'zustand';

export type ActiveZone = {
  id: string; name: string; deliveryFeePaise: number; minOrderPaise: number; etaMinutes: number;
};

type LocationState = {
  serviceable: boolean | null;
  zone: ActiveZone | null;
  addressId: string | null;
  addressLabel: string | null;
  setResolved: (serviceable: boolean, zone: ActiveZone | null) => void;
  setAddress: (id: string, label: string) => void;
};

export const useLocationStore = create<LocationState>((set) => ({
  serviceable: null,
  zone: null,
  addressId: null,
  addressLabel: null,
  setResolved: (serviceable, zone) => set({ serviceable, zone }),
  setAddress: (addressId, addressLabel) => set({ addressId, addressLabel }),
}));

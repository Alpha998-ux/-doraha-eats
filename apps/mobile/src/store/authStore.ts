import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type Role = 'CUSTOMER' | 'VENDOR' | 'DELIVERY' | 'ADMIN';
export type SessionUser = {
  id: string; role: Role; fullName: string;
  email: string | null; phone: string | null; locale: string;
};

const Storage = {
  getItemAsync: (key: string) =>
    Platform.OS === 'web' ? Promise.resolve(localStorage.getItem(key)) : SecureStore.getItemAsync(key),
  setItemAsync: (key: string, value: string) =>
    Platform.OS === 'web' ? Promise.resolve(localStorage.setItem(key, value)) : SecureStore.setItemAsync(key, value),
  deleteItemAsync: (key: string) =>
    Platform.OS === 'web' ? Promise.resolve(localStorage.removeItem(key)) : SecureStore.deleteItemAsync(key),
};

type AuthState = {
  user: SessionUser | null;
  token: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (user: SessionUser, token: string) => Promise<void>;
  logout: () => Promise<void>;
};

const TOKEN_KEY = 'doraha_token';
const USER_KEY = 'doraha_user';

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  hydrated: false,
  hydrate: async () => {
    try {
      const [token, userJson] = await Promise.all([
        Storage.getItemAsync(TOKEN_KEY),
        Storage.getItemAsync(USER_KEY),
      ]);
      set({
        token: token ?? null,
        user: userJson ? (JSON.parse(userJson) as SessionUser) : null,
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },
  setSession: async (user, token) => {
    await Storage.setItemAsync(TOKEN_KEY, token);
    await Storage.setItemAsync(USER_KEY, JSON.stringify(user));
    set({ user, token });
  },
  logout: async () => {
    await Storage.deleteItemAsync(TOKEN_KEY);
    await Storage.deleteItemAsync(USER_KEY);
    set({ user: null, token: null });
  },
}));
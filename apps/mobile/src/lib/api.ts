import Constants from 'expo-constants';
import { useAuthStore } from '../store/authStore';

const BASE =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

type Options = { method?: string; body?: unknown; token?: string; skipAuth?: boolean };

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const token = opts.token ?? (opts.skipAuth ? undefined : useAuthStore.getState().token);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    // Network failure — never crash the app, always a friendly message.
    throw new ApiError(0, 'NETWORK_ERROR', 'No internet connection. Please try again.');
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = json?.error ?? { code: 'UNKNOWN', message: 'Something went wrong. Please try again.' };
    throw new ApiError(res.status, err.code, err.message, err.details);
  }
  return json as T;
}

export const API_BASE = BASE;

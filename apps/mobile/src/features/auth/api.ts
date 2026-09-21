import { api } from '../../lib/api';
import type { SessionUser } from '../../store/authStore';

export const requestOtp = (phone: string) =>
  api<{ sent: boolean; expiresInSeconds: number }>('/auth/otp/request', {
    method: 'POST', body: { phone }, skipAuth: true,
  });

export const verifyOtp = (phone: string, code: string, fullName?: string) =>
  api<{ user: SessionUser; token: string }>('/auth/otp/verify', {
    method: 'POST', body: { phone, code, fullName }, skipAuth: true,
  });

export const login = (email: string, password: string) =>
  api<{ user: SessionUser; token: string }>('/auth/login', {
    method: 'POST', body: { email, password }, skipAuth: true,
  });

export const register = (input: {
  fullName: string; password: string; phone?: string; email?: string; role?: 'CUSTOMER' | 'DELIVERY';
}) => api<{ user: SessionUser; token: string }>('/auth/register', {
  method: 'POST', body: input, skipAuth: true,
});

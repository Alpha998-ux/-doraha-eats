'use client';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ApiError } from '@/lib/api';
import { Button, ErrorBanner } from '@/components/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@dorahaeats.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try { await login(email, password); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Login failed.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <form onSubmit={submit} className="w-full max-w-sm bg-white border border-neutral-200 rounded-xl p-6">
        <div className="text-xl font-bold text-[#E8552D] mb-1">Doraha Eats</div>
        <div className="text-sm text-neutral-500 mb-6">Admin panel login</div>
        {error && <ErrorBanner message={error} />}
        <label className="block text-xs font-medium text-neutral-600 mb-1">Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
          className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm mb-3" required />
        <label className="block text-xs font-medium text-neutral-600 mb-1">Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
          className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm mb-5" required />
        <Button type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</Button>
        <div className="text-xs text-neutral-400 mt-4">Demo: admin@dorahaeats.local / Doraha@123</div>
      </form>
    </div>
  );
}

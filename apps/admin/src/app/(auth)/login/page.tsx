'use client';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ApiError } from '@/lib/api';
import { Button, ErrorBanner } from '@/components/ui';
import { googleAuth } from '@/features/auth/api'; // Make sure this matches your project's import path

export default function LoginPage() {
  const { login, setSession } = useAuth(); // Assuming setSession or similar exists in your auth provider to load user/token
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

  // Google Web Auth handler
  async function handleGoogleLogin() {
    setError(null);
    setBusy(true);
    try {
      // For web, you can use Google's GIS (Google Identity Services) popup/token client 
      // or redirect to your backend OAuth flow. Assuming you obtain an idToken:
      const idToken = "OBTAINED_GOOGLE_ID_TOKEN_FROM_GIS"; 
      const { user, token } = await googleAuth(idToken);
      // Save session into your auth context/store
      // setSession(user, token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
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

        <div className="relative flex py-3 items-center">
          <div className="flex-grow border-t border-neutral-200"></div>
          <span className="flex-shrink mx-3 text-neutral-400 text-xs uppercase">or</span>
          <div className="flex-grow border-t border-neutral-200"></div>
        </div>

        {/* Google Sign In Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 border border-neutral-300 rounded-lg py-2 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          Sign in with Google
        </button>

        <div className="text-xs text-neutral-400 mt-4">Demo: admin@dorahaeats.local / Doraha@123</div>
      </form>
    </div>
  );
}

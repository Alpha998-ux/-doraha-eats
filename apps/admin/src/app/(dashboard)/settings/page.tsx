'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Settings } from '@/lib/types';
import { Card, Button, ErrorBanner } from '@/components/ui';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<{ settings: Settings }>('/admin/settings').then((r) => setSettings(r.settings)).catch((e) => setError(e.message));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setError(null); setSaved(false);
    try {
      const r = await api<{ settings: Settings }>('/admin/settings', { method: 'PUT', body: settings });
      setSettings(r.settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to save.'); }
  }

  if (!settings) return <div className="text-neutral-400 text-sm">Loading...</div>;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings({ ...settings, [k]: v });

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Settings</h1>
      <p className="text-sm text-neutral-500 mb-6">Business rules used across the whole platform — nothing here is hard-coded in the apps.</p>
      {error && <ErrorBanner message={error} />}
      {saved && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2 mb-4">Settings saved.</div>}

      <form onSubmit={save} className="space-y-6">
        <Card>
          <div className="text-sm font-semibold mb-3">Branding</div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Brand name"><input className="in" value={settings.brandName} onChange={(e) => set('brandName', e.target.value)} /></F>
            <F label="Tagline"><input className="in" value={settings.brandTagline} onChange={(e) => set('brandTagline', e.target.value)} /></F>
            <F label="Primary color"><input className="in" value={settings.brandPrimaryColor} onChange={(e) => set('brandPrimaryColor', e.target.value)} /></F>
            <F label="Support phone"><input className="in" value={settings.supportPhone} onChange={(e) => set('supportPhone', e.target.value)} /></F>
          </div>
        </Card>

        <Card>
          <div className="text-sm font-semibold mb-3">Fees & commission</div>
          <div className="grid grid-cols-3 gap-3">
            <F label="Platform fee (paise)"><input type="number" className="in" value={settings.platformFeePaise} onChange={(e) => set('platformFeePaise', Number(e.target.value))} /></F>
            <F label="Default vendor commission (%)"><input type="number" step="0.1" className="in" value={settings.commissionPct} onChange={(e) => set('commissionPct', Number(e.target.value))} /></F>
            <F label="Tax (%)"><input type="number" step="0.1" className="in" value={settings.taxPct} onChange={(e) => set('taxPct', Number(e.target.value))} /></F>
            <F label="Rider payout per delivery (paise)"><input type="number" className="in" value={settings.riderPayoutPaise} onChange={(e) => set('riderPayoutPaise', Number(e.target.value))} /></F>
            <F label="Cancel window (seconds)"><input type="number" className="in" value={settings.cancelWindowSeconds} onChange={(e) => set('cancelWindowSeconds', Number(e.target.value))} /></F>
            <F label="Default language"><select className="in" value={settings.defaultLocale} onChange={(e) => set('defaultLocale', e.target.value)}>
              <option value="en">English</option><option value="hi">Hindi</option><option value="pa">Punjabi</option>
            </select></F>
          </div>
        </Card>

        <Button type="submit">Save settings</Button>
      </form>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>{children}</div>;
}

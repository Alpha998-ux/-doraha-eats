'use client';
import { useEffect, useState } from 'react';
import { api, paise, ApiError } from '@/lib/api';
import type { Zone } from '@/lib/types';
import { Card, Table, Badge, Button, ErrorBanner } from '@/components/ui';

const empty = {
  name: '', description: '', city: 'Doraha', district: 'Ludhiana', state: 'Punjab',
  latitude: 30.7996, longitude: 76.0236, radiusMeters: 2000,
  deliveryFeePaise: 2000, minOrderPaise: 9900, etaMinutes: 35, priority: 0,
};

export default function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testCoords, setTestCoords] = useState({ latitude: 30.80, longitude: 76.02 });

  const load = () => api<{ zones: Zone[] }>('/admin/zones').then((r) => setZones(r.zones)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function toggleActive(z: Zone) {
    await api(`/admin/zones/${z.id}`, { method: 'PATCH', body: { isActive: !z.isActive } });
    load();
  }

  async function createZone(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/admin/zones', { method: 'POST', body: form });
      setForm(empty); setShowForm(false); load();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Failed to create zone.'); }
  }

  async function runTest() {
    const r = await api<{ serviceable: boolean; zone: Zone | null }>('/admin/zones/test', {
      method: 'POST', body: testCoords,
    });
    setTestResult(r.serviceable ? `Serviceable — resolves to "${r.zone!.name}"` : 'Not serviceable at these coordinates.');
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Delivery Zones</h1>
          <p className="text-sm text-neutral-500">A new zone is inactive until you switch it on — expansion is always opt-in.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : '+ New zone'}</Button>
      </div>
      {error && <ErrorBanner message={error} />}

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={createZone} className="grid grid-cols-3 gap-3">
            <Field label="Name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="in" /></Field>
            <Field label="Latitude"><input required type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })} className="in" /></Field>
            <Field label="Longitude"><input required type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })} className="in" /></Field>
            <Field label="Radius (m)"><input required type="number" value={form.radiusMeters} onChange={(e) => setForm({ ...form, radiusMeters: Number(e.target.value) })} className="in" /></Field>
            <Field label="Delivery fee (paise)"><input required type="number" value={form.deliveryFeePaise} onChange={(e) => setForm({ ...form, deliveryFeePaise: Number(e.target.value) })} className="in" /></Field>
            <Field label="Min order (paise)"><input required type="number" value={form.minOrderPaise} onChange={(e) => setForm({ ...form, minOrderPaise: Number(e.target.value) })} className="in" /></Field>
            <Field label="ETA (min)"><input required type="number" value={form.etaMinutes} onChange={(e) => setForm({ ...form, etaMinutes: Number(e.target.value) })} className="in" /></Field>
            <Field label="Priority"><input required type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} className="in" /></Field>
            <div className="col-span-3"><Button type="submit">Create zone (inactive)</Button></div>
          </form>
        </Card>
      )}

      <Card className="mb-6">
        <div className="text-sm font-medium mb-2">Coordinate tester</div>
        <div className="flex gap-2 items-end">
          <Field label="Latitude"><input type="number" step="any" value={testCoords.latitude} onChange={(e) => setTestCoords({ ...testCoords, latitude: Number(e.target.value) })} className="in w-32" /></Field>
          <Field label="Longitude"><input type="number" step="any" value={testCoords.longitude} onChange={(e) => setTestCoords({ ...testCoords, longitude: Number(e.target.value) })} className="in w-32" /></Field>
          <Button onClick={runTest} variant="secondary">Test</Button>
        </div>
        {testResult && <div className="text-sm mt-3 text-neutral-700">{testResult}</div>}
      </Card>

      <Card>
        <Table headers={['Zone', 'Coverage', 'Fee', 'Min order', 'ETA', 'Status', '']}>
          {zones.map((z) => (
            <tr key={z.id}>
              <td className="py-2 pr-4 font-medium">{z.name}<div className="text-xs text-neutral-400">{z.city}, {z.district}</div></td>
              <td className="py-2 pr-4 text-neutral-500">{z.radiusMeters}m radius</td>
              <td className="py-2 pr-4">{paise(z.deliveryFeePaise)}</td>
              <td className="py-2 pr-4">{paise(z.minOrderPaise)}</td>
              <td className="py-2 pr-4">{z.etaMinutes} min</td>
              <td className="py-2 pr-4">{z.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="yellow">Inactive</Badge>}</td>
              <td className="py-2 pr-4">
                <Button variant="secondary" onClick={() => toggleActive(z)}>{z.isActive ? 'Deactivate' : 'Activate'}</Button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

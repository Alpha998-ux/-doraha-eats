'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Vendor } from '@/lib/types';
import { Card, Table, Badge, Button, ErrorBanner } from '@/components/ui';

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED'>('ALL');

  const load = () => api<{ vendors: Vendor[] }>('/admin/vendors').then((r) => setVendors(r.vendors)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function approve(id: string) { await api(`/admin/vendors/${id}/approve`, { method: 'POST' }); load(); }
  async function reject(id: string) { await api(`/admin/vendors/${id}/reject`, { method: 'POST' }); load(); }
  async function suspend(id: string) { await api(`/admin/vendors/${id}`, { method: 'PATCH', body: { status: 'SUSPENDED' } }); load(); }
  async function reactivate(id: string) { await api(`/admin/vendors/${id}`, { method: 'PATCH', body: { status: 'ACTIVE' } }); load(); }

  const shown = filter === 'ALL' ? vendors : vendors.filter((v) => v.status === filter);
  const toneFor = (s: string) => ({ PENDING: 'yellow', ACTIVE: 'green', SUSPENDED: 'red', REJECTED: 'red' } as const)[s] ?? 'neutral';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Vendors</h1>
          <p className="text-sm text-neutral-500">Approve, reject or manage local stalls.</p>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as never)} className="in w-40">
          {['ALL', 'PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {error && <ErrorBanner message={error} />}

      <Card>
        <Table headers={['Stall', 'Owner', 'Zone', 'Rating', 'Status', '']}>
          {shown.map((v) => (
            <tr key={v.id}>
              <td className="py-2 pr-4 font-medium">{v.name}{v.isDemo && <span className="ml-2 text-xs text-neutral-400">(demo)</span>}</td>
              <td className="py-2 pr-4 text-neutral-500">{v.ownerName}<div className="text-xs text-neutral-400">{v.owner.phone ?? v.owner.email}</div></td>
              <td className="py-2 pr-4 text-neutral-500">{v.zone?.name ?? '—'}</td>
              <td className="py-2 pr-4">{v.ratingAvg.toFixed(1)} ({v.ratingCount})</td>
              <td className="py-2 pr-4"><Badge tone={toneFor(v.status)}>{v.status}</Badge></td>
              <td className="py-2 pr-4 space-x-2">
                {v.status === 'PENDING' && <>
                  <Button onClick={() => approve(v.id)}>Approve</Button>
                  <Button variant="danger" onClick={() => reject(v.id)}>Reject</Button>
                </>}
                {v.status === 'ACTIVE' && <Button variant="secondary" onClick={() => suspend(v.id)}>Suspend</Button>}
                {(v.status === 'SUSPENDED' || v.status === 'REJECTED') && <Button variant="secondary" onClick={() => reactivate(v.id)}>Reactivate</Button>}
              </td>
            </tr>
          ))}
        </Table>
        {!shown.length && <div className="text-center py-8 text-sm text-neutral-400">No vendors in this filter.</div>}
      </Card>
    </div>
  );
}

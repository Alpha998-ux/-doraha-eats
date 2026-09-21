'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Partner } from '@/lib/types';
import { Card, Table, Badge, Button, ErrorBanner } from '@/components/ui';

export default function RidersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => api<{ partners: Partner[] }>('/admin/delivery-partners').then((r) => setPartners(r.partners)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function approve(id: string) { await api(`/admin/delivery-partners/${id}/approve`, { method: 'POST' }); load(); }
  async function reject(id: string) { await api(`/admin/delivery-partners/${id}/reject`, { method: 'POST' }); load(); }

  const toneFor = (s: string) => ({ PENDING: 'yellow', ACTIVE: 'green', SUSPENDED: 'red', REJECTED: 'red' } as const)[s] ?? 'neutral';

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Delivery Partners</h1>
      <p className="text-sm text-neutral-500 mb-6">Verify and manage local delivery partners.</p>
      {error && <ErrorBanner message={error} />}
      <Card>
        <Table headers={['Name', 'Contact', 'Vehicle', 'Online', 'Status', '']}>
          {partners.map((p) => (
            <tr key={p.id}>
              <td className="py-2 pr-4 font-medium">{p.user.fullName}</td>
              <td className="py-2 pr-4 text-neutral-500">{p.user.phone ?? p.user.email}</td>
              <td className="py-2 pr-4 text-neutral-500">{p.vehicle}</td>
              <td className="py-2 pr-4">{p.isOnline ? <Badge tone="green">Online</Badge> : <Badge>Offline</Badge>}</td>
              <td className="py-2 pr-4"><Badge tone={toneFor(p.status)}>{p.status}</Badge></td>
              <td className="py-2 pr-4 space-x-2">
                {p.status === 'PENDING' && <>
                  <Button onClick={() => approve(p.id)}>Approve</Button>
                  <Button variant="danger" onClick={() => reject(p.id)}>Reject</Button>
                </>}
              </td>
            </tr>
          ))}
        </Table>
        {!partners.length && <div className="text-center py-8 text-sm text-neutral-400">No delivery partners yet.</div>}
      </Card>
    </div>
  );
}

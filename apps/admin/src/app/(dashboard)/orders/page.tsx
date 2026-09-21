'use client';
import { useEffect, useState } from 'react';
import { api, paise } from '@/lib/api';
import type { OrderRow } from '@/lib/types';
import { Card, Table, Badge, Button, ErrorBanner } from '@/components/ui';

const STATUSES = ['ALL', 'PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'];

const toneFor = (s: string) => {
  if (s === 'DELIVERED') return 'green' as const;
  if (s === 'CANCELLED') return 'red' as const;
  if (['PLACED', 'ACCEPTED'].includes(s)) return 'yellow' as const;
  return 'blue' as const;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [status, setStatus] = useState('ALL');
  const [error, setError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<Record<string, string>>({});

  const load = () => {
    const q = status === 'ALL' ? '' : `?status=${status}`;
    api<{ orders: OrderRow[] }>(`/admin/orders${q}`).then((r) => setOrders(r.orders)).catch((e) => setError(e.message));
  };
  useEffect(() => { load(); }, [status]);

  async function cancel(id: string) {
    const reason = cancelReason[id] || 'Cancelled by admin';
    await api(`/admin/orders/${id}/cancel`, { method: 'POST', body: { reason } });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Orders</h1>
          <p className="text-sm text-neutral-500">Live view across all zones.</p>
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="in w-44">
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {error && <ErrorBanner message={error} />}
      <Card>
        <Table headers={['Code', 'Vendor', 'Customer', 'Zone', 'Total', 'Payment', 'Status', 'Placed', '']}>
          {orders.map((o) => (
            <tr key={o.id}>
              <td className="py-2 pr-4 font-mono text-xs">{o.code}</td>
              <td className="py-2 pr-4">{o.vendor.name}</td>
              <td className="py-2 pr-4 text-neutral-500">{o.customer.fullName}</td>
              <td className="py-2 pr-4 text-neutral-500">{o.zone.name}</td>
              <td className="py-2 pr-4">{paise(o.totalPaise)}</td>
              <td className="py-2 pr-4 text-neutral-500">{o.paymentMethod} / {o.paymentStatus}</td>
              <td className="py-2 pr-4"><Badge tone={toneFor(o.status)}>{o.status}</Badge></td>
              <td className="py-2 pr-4 text-neutral-400 text-xs">{new Date(o.placedAt).toLocaleString('en-IN')}</td>
              <td className="py-2 pr-4">
                {!['DELIVERED', 'CANCELLED'].includes(o.status) && (
                  <div className="flex gap-1">
                    <input
                      placeholder="Reason"
                      value={cancelReason[o.id] ?? ''}
                      onChange={(e) => setCancelReason({ ...cancelReason, [o.id]: e.target.value })}
                      className="in w-28 text-xs"
                    />
                    <Button variant="danger" onClick={() => cancel(o.id)}>Cancel</Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Table>
        {!orders.length && <div className="text-center py-8 text-sm text-neutral-400">No orders for this filter.</div>}
      </Card>
    </div>
  );
}

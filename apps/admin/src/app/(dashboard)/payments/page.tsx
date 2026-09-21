'use client';
import { useEffect, useState } from 'react';
import { api, paise } from '@/lib/api';
import type { PendingPayment } from '@/lib/types';
import { Card, Table, Button, ErrorBanner, EmptyState } from '@/components/ui';

export default function PaymentsPage() {
  const [rows, setRows] = useState<PendingPayment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => api<{ payments: PendingPayment[] }>('/admin/payments/pending')
    .then((r) => setRows(r.payments)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function verify(paymentId: string) {
    await api(`/admin/payments/${paymentId}/verify`, { method: 'POST' });
    load();
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Payments</h1>
      <p className="text-sm text-neutral-500 mb-6">UPI payments awaiting manual verification.</p>
      {error && <ErrorBanner message={error} />}
      <Card>
        <Table headers={['Order', 'Provider', 'Amount', 'UTR entered', '']}>
          {rows.map((r) => (
            <tr key={r.p.id}>
              <td className="py-2 pr-4 font-mono text-xs">{r.o.code}</td>
              <td className="py-2 pr-4 text-neutral-500">{r.p.provider}</td>
              <td className="py-2 pr-4">{paise(r.p.amountPaise)}</td>
              <td className="py-2 pr-4 font-mono text-xs">{r.p.upiRef ?? '—'}</td>
              <td className="py-2 pr-4"><Button onClick={() => verify(r.p.id)}>Mark paid</Button></td>
            </tr>
          ))}
        </Table>
        {!rows.length && <EmptyState text="No payments waiting for verification." />}
      </Card>
    </div>
  );
}

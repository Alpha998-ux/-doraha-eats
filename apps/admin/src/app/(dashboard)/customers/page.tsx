'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Customer } from '@/lib/types';
import { Card, Table, Badge, Button, ErrorBanner } from '@/components/ui';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => api<{ customers: Customer[] }>('/admin/customers').then((r) => setCustomers(r.customers)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function toggle(c: Customer) {
    await api(`/admin/users/${c.id}/status`, { method: 'PATCH', body: { status: c.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' } });
    load();
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Customers</h1>
      <p className="text-sm text-neutral-500 mb-6">All registered customers.</p>
      {error && <ErrorBanner message={error} />}
      <Card>
        <Table headers={['Name', 'Contact', 'Orders', 'Joined', 'Status', '']}>
          {customers.map((c) => (
            <tr key={c.id}>
              <td className="py-2 pr-4 font-medium">{c.fullName}</td>
              <td className="py-2 pr-4 text-neutral-500">{c.phone ?? c.email}</td>
              <td className="py-2 pr-4">{c.orderCount}</td>
              <td className="py-2 pr-4 text-neutral-400 text-xs">{new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
              <td className="py-2 pr-4">{c.status === 'ACTIVE' ? <Badge tone="green">Active</Badge> : <Badge tone="red">Suspended</Badge>}</td>
              <td className="py-2 pr-4"><Button variant="secondary" onClick={() => toggle(c)}>{c.status === 'ACTIVE' ? 'Suspend' : 'Activate'}</Button></td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}

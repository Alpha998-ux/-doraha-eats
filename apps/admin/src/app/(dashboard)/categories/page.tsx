'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Category } from '@/lib/types';
import { Card, Table, Badge, Button, ErrorBanner } from '@/components/ui';

export default function CategoriesPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ slug: '', name: '', icon: '' });

  const load = () => api<{ categories: Category[] }>('/admin/categories').then((r) => setCats(r.categories)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api('/admin/categories', { method: 'POST', body: form });
    setForm({ slug: '', name: '', icon: '' });
    load();
  }

  async function toggle(c: Category) {
    await api(`/admin/categories/${c.id}`, { method: 'PATCH', body: { isActive: !c.isActive } });
    load();
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Categories</h1>
      <p className="text-sm text-neutral-500 mb-6">Food categories shown on the customer home screen.</p>
      {error && <ErrorBanner message={error} />}

      <Card className="mb-6">
        <form onSubmit={create} className="flex gap-2 items-end">
          <div><label className="block text-xs text-neutral-600 mb-1">Slug</label><input required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="in w-32" /></div>
          <div><label className="block text-xs text-neutral-600 mb-1">Name</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="in w-40" /></div>
          <div><label className="block text-xs text-neutral-600 mb-1">Icon (emoji)</label><input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="in w-20" /></div>
          <Button type="submit">Add</Button>
        </form>
      </Card>

      <Card>
        <Table headers={['Icon', 'Name', 'Slug', 'Status', '']}>
          {cats.map((c) => (
            <tr key={c.id}>
              <td className="py-2 pr-4 text-lg">{c.icon}</td>
              <td className="py-2 pr-4 font-medium">{c.name}</td>
              <td className="py-2 pr-4 text-neutral-500">{c.slug}</td>
              <td className="py-2 pr-4">{c.isActive ? <Badge tone="green">Active</Badge> : <Badge>Hidden</Badge>}</td>
              <td className="py-2 pr-4"><Button variant="secondary" onClick={() => toggle(c)}>{c.isActive ? 'Hide' : 'Show'}</Button></td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { ReviewRow } from '@/lib/types';
import { Card, Table, Badge, Button, ErrorBanner, EmptyState } from '@/components/ui';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => api<{ reviews: ReviewRow[] }>('/admin/reviews').then((r) => setReviews(r.reviews)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function toggleHide(r: ReviewRow) {
    await api(`/admin/reviews/${r.id}`, { method: 'PATCH', body: { isHidden: !r.isHidden } });
    load();
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Reviews</h1>
      <p className="text-sm text-neutral-500 mb-6">Moderate customer reviews across all vendors.</p>
      {error && <ErrorBanner message={error} />}
      <Card>
        <Table headers={['Vendor', 'Customer', 'Rating', 'Comment', 'Status', '']}>
          {reviews.map((r) => (
            <tr key={r.id}>
              <td className="py-2 pr-4 font-medium">{r.vendor.name}</td>
              <td className="py-2 pr-4 text-neutral-500">{r.customer.fullName}</td>
              <td className="py-2 pr-4">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</td>
              <td className="py-2 pr-4 text-neutral-600 max-w-xs truncate">{r.comment ?? '—'}</td>
              <td className="py-2 pr-4">{r.isHidden ? <Badge tone="red">Hidden</Badge> : <Badge tone="green">Visible</Badge>}</td>
              <td className="py-2 pr-4"><Button variant="secondary" onClick={() => toggleHide(r)}>{r.isHidden ? 'Unhide' : 'Hide'}</Button></td>
            </tr>
          ))}
        </Table>
        {!reviews.length && <EmptyState text="No reviews yet." />}
      </Card>
    </div>
  );
}

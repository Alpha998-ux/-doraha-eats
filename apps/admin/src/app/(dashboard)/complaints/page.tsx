'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Complaint } from '@/lib/types';
import { Card, Badge, Button, ErrorBanner, EmptyState } from '@/components/ui';

const toneFor = (s: string) => ({ OPEN: 'yellow', IN_PROGRESS: 'blue', RESOLVED: 'green', REJECTED: 'red' } as const)[s] ?? 'neutral';

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resolution, setResolution] = useState<Record<string, string>>({});

  const load = () => api<{ complaints: Complaint[] }>('/admin/complaints').then((r) => setComplaints(r.complaints)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: string) {
    await api(`/admin/complaints/${id}`, { method: 'PATCH', body: { status, resolution: resolution[id] } });
    load();
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Complaints</h1>
      <p className="text-sm text-neutral-500 mb-6">Support tickets raised by customers.</p>
      {error && <ErrorBanner message={error} />}
      <div className="space-y-3">
        {complaints.map((c) => (
          <Card key={c.id}>
            <div className="flex justify-between">
              <div>
                <div className="font-medium">{c.subject}</div>
                <div className="text-xs text-neutral-400">{c.user.fullName} · {new Date(c.createdAt).toLocaleString('en-IN')}</div>
              </div>
              <Badge tone={toneFor(c.status)}>{c.status}</Badge>
            </div>
            <p className="text-sm text-neutral-700 mt-2">{c.message}</p>
            {c.status !== 'RESOLVED' && c.status !== 'REJECTED' && (
              <div className="flex gap-2 mt-3">
                <input
                  placeholder="Resolution note"
                  value={resolution[c.id] ?? ''}
                  onChange={(e) => setResolution({ ...resolution, [c.id]: e.target.value })}
                  className="in flex-1"
                />
                <Button onClick={() => setStatus(c.id, 'RESOLVED')}>Resolve</Button>
                <Button variant="secondary" onClick={() => setStatus(c.id, 'IN_PROGRESS')}>In progress</Button>
                <Button variant="danger" onClick={() => setStatus(c.id, 'REJECTED')}>Reject</Button>
              </div>
            )}
          </Card>
        ))}
        {!complaints.length && <EmptyState text="No complaints." />}
      </div>
    </div>
  );
}

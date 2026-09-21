'use client';
import { useEffect, useState } from 'react';
import { api, paise, ApiError } from '@/lib/api';
import type { AnalyticsResponse } from '@/lib/types';
import { StatCard, Card, ErrorBanner } from '@/components/ui';

export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<AnalyticsResponse>('/admin/analytics')
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load analytics.'));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!data) return <div className="text-neutral-400 text-sm">Loading...</div>;

  const c = data.cards;
  const maxOrders = Math.max(1, ...data.charts.daily.map((d) => d.orders));

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Dashboard</h1>
      <p className="text-sm text-neutral-500 mb-6">Doraha Eats — live overview</p>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total customers" value={c.totalCustomers} />
        <StatCard label="Active vendors" value={`${c.activeVendors} / ${c.totalVendors}`} />
        <StatCard label="Online riders" value={`${c.onlineDeliveryPartners} / ${c.activeDeliveryPartners}`} />
        <StatCard label="Food items" value={c.totalFoodItems} />
        <StatCard label="Today's orders" value={c.todayOrders} />
        <StatCard label="Pending orders" value={c.pendingOrders} />
        <StatCard label="Delivered orders" value={c.deliveredOrders} />
        <StatCard label="Total revenue" value={paise(c.revenuePaise)} sub={`Commission ${paise(c.commissionPaise)}`} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="text-sm font-medium mb-3">Orders — last 14 days</div>
          <div className="flex items-end gap-1 h-32">
            {data.charts.daily.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${d.day}: ${d.orders} orders`}>
                <div className="w-full bg-[#E8552D] rounded-t" style={{ height: `${(d.orders / maxOrders) * 100}%`, minHeight: d.orders ? 4 : 0 }} />
              </div>
            ))}
          </div>
          {!data.charts.daily.length && <div className="text-xs text-neutral-400">No orders yet in this window.</div>}
        </Card>
        <Card>
          <div className="text-sm font-medium mb-3">Top vendors</div>
          <div className="space-y-2">
            {data.charts.topVendors.map((v) => (
              <div key={v.vendorId} className="flex justify-between text-sm">
                <span className="text-neutral-700">{v.name}</span>
                <span className="text-neutral-500">{v.orders} orders · {paise(v.revenuePaise)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

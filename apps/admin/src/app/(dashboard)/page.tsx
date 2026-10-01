'use client';

import { useEffect, useState } from 'react';
import { api, paise, ApiError } from '@/lib/api';
import type { AnalyticsResponse } from '@/lib/types';
import { StatCard, Card, ErrorBanner } from '@/components/ui';

export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchAnalytics = () => {
      api<AnalyticsResponse>('/admin/analytics')
        .then((res) => {
          if (isMounted) setData(res);
        })
        .catch((e) => {
          if (isMounted) {
            setError(e instanceof ApiError ? e.message : 'Failed to load analytics.');
          }
        });
    };

    fetchAnalytics();

    // Auto-refresh stats every 30 seconds for live admin view
    const interval = setInterval(fetchAnalytics, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!data) return <div className="text-neutral-400 text-sm p-4">Loading analytics...</div>;

  const c = data.cards;
  const dailyData = data.charts?.daily ?? [];
  const topVendors = data.charts?.topVendors ?? [];

  // Prevent division by zero or empty array calculations
  const orderCounts = dailyData.map((d) => d.orders);
  const maxOrders = orderCounts.length > 0 ? Math.max(1, ...orderCounts) : 1;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-bold mb-1">Dashboard</h1>
      <p className="text-sm text-neutral-500 mb-6">Doraha Eats — live overview</p>

      {/* Responsive Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total customers" value={c.totalCustomers} />
        <StatCard label="Active vendors" value={`${c.activeVendors} / ${c.totalVendors}`} />
        <StatCard label="Online riders" value={`${c.onlineDeliveryPartners} / ${c.activeDeliveryPartners}`} />
        <StatCard label="Food items" value={c.totalFoodItems} />
        <StatCard label="Today's orders" value={c.todayOrders} />
        <StatCard label="Pending orders" value={c.pendingOrders} />
        <StatCard label="Delivered orders" value={c.deliveredOrders} />
        <StatCard label="Total revenue" value={paise(c.revenuePaise)} sub={`Commission ${paise(c.commissionPaise)}`} />
      </div>

      {/* Responsive Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Orders Chart */}
        <Card>
          <div className="text-sm font-medium mb-3">Orders — last 14 days</div>
          {dailyData.length > 0 ? (
            <div className="flex items-end gap-1 h-36 pt-4">
              {dailyData.map((d) => {
                const barHeight = Math.round((d.orders / maxOrders) * 100);
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${d.day}: ${d.orders} orders`}>
                    <div 
                      className="w-full bg-[#E8552D] rounded-t transition-all duration-300" 
                      style={{ height: `${barHeight}%`, minHeight: d.orders > 0 ? '4px' : '0px' }} 
                    />
                    <span className="text-[10px] text-neutral-400 truncate w-full text-center">
                      {d.day.slice(-2)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-neutral-400 py-8 text-center">No orders yet in this window.</div>
          )}
        </Card>

        {/* Top Vendors Card */}
        <Card>
          <div className="text-sm font-medium mb-3">Top vendors</div>
          {topVendors.length > 0 ? (
            <div className="space-y-3">
              {topVendors.map((v) => (
                <div key={v.vendorId} className="flex justify-between items-center text-sm border-b border-neutral-100 pb-2 last:border-0">
                  <span className="text-neutral-700 font-medium">{v.name}</span>
                  <span className="text-neutral-500 text-xs">
                    {v.orders} orders · <strong className="text-neutral-800">{paise(v.revenuePaise)}</strong>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-neutral-400 py-8 text-center">No vendor data available.</div>
          )}
        </Card>
      </div>
    </div>
  );
    }
      

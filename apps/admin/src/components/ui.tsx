'use client';
import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-neutral-200 p-5 ${className}`}>{children}</div>;
}

export function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-neutral-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-neutral-400 mt-1">{sub}</div>}
    </Card>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'red' | 'yellow' | 'blue' }) {
  const tones = {
    neutral: 'bg-neutral-100 text-neutral-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    blue: 'bg-blue-100 text-blue-700',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Button({
  children, onClick, variant = 'primary', disabled, type = 'button',
}: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean; type?: 'button' | 'submit';
}) {
  const variants = {
    primary: 'bg-[#E8552D] text-white hover:bg-[#C33F1C]',
    secondary: 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-neutral-500">
            {headers.map((h) => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="text-center py-10 text-neutral-400 text-sm">{text}</div>;
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">{message}</div>;
}

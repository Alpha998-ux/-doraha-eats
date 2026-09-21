'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';

const NAV = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/orders', label: 'Orders', icon: '🧾' },
  { href: '/vendors', label: 'Vendors', icon: '🏪' },
  { href: '/riders', label: 'Delivery Partners', icon: '🛵' },
  { href: '/customers', label: 'Customers', icon: '👥' },
  { href: '/zones', label: 'Delivery Zones', icon: '📍' },
  { href: '/categories', label: 'Categories', icon: '🍽️' },
  { href: '/payments', label: 'Payments', icon: '💳' },
  { href: '/reviews', label: 'Reviews', icon: '⭐' },
  { href: '/complaints', label: 'Complaints', icon: '⚠️' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 shrink-0 border-r border-neutral-200 bg-white flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-neutral-200">
        <div className="text-lg font-bold text-[#E8552D]">Doraha Eats</div>
        <div className="text-xs text-neutral-500">Admin panel</div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-5 py-2.5 text-sm ${
                active ? 'bg-orange-50 text-[#E8552D] font-medium border-r-2 border-[#E8552D]' : 'text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-neutral-200">
        <div className="text-sm font-medium text-neutral-900">{user?.fullName}</div>
        <div className="text-xs text-neutral-500 mb-2">{user?.email}</div>
        <button onClick={logout} className="text-xs text-neutral-500 hover:text-red-600">Log out</button>
      </div>
    </aside>
  );
}

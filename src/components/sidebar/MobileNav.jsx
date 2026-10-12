'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Boxes, ClipboardCheck, Database } from 'lucide-react';

export default function MobileNav() {
  const pathname = usePathname();

  const navs = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/inventory', label: 'Stock & Items', icon: Boxes },
    { href: '/stock-opname', label: 'Stock Opname', icon: ClipboardCheck },
    { href: '/master-data', label: 'Master Data', icon: Database },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 py-2.5 px-4 flex justify-around items-center z-40 shadow-lg">
      {navs.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)) || (item.href === '/' && pathname === '/index.html');
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-1 text-[10px] font-medium transition cursor-pointer select-none ${
              isActive ? 'text-blue-600 font-bold' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

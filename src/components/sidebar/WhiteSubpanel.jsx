'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardCheck,
  Database,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';

export default function WhiteSubpanel({ isCollapsed, onToggle }) {
  const pathname = usePathname();

  const menus = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Inventory', href: '/inventory', icon: ClipboardCheck },
    { label: 'Inbound', href: '/inbound', icon: ArrowDownLeft },
    { label: 'Outbound', href: '/outbound', icon: ArrowUpRight },
    { label: 'Master Data', href: '/master-data', icon: Database },
    { label: 'Settings & Roles', href: '/settings', icon: Settings },
  ];

  if (isCollapsed) {
    return (
      <button
        onClick={onToggle}
        className="fixed top-4 left-20 z-50 bg-white border border-stone-200 p-2.5 rounded-xl shadow-md text-stone-600 hover:text-stone-900 transition cursor-pointer flex items-center justify-center"
        title="Show Sidebar"
      >
        <PanelLeftOpen size={18} />
      </button>
    );
  }

  return (
    <div className="w-64 bg-white border-r border-stone-200/80 flex flex-col justify-between py-6 px-4 shrink-0 select-none transition-all duration-300 relative">
      <div>
        {/* Module Header & Collapse Button */}
        <div className="mb-6 px-2 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-900 tracking-tight">INVENTORY</h2>
            <p className="text-[11px] text-stone-400 mt-0.5">Warehouse System</p>
          </div>
          <button
            onClick={onToggle}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition cursor-pointer"
            title="Hide Sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        {/* Section: Navigation */}
        <div className="mb-6">
          <div className="space-y-1">
            {menus.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-50/80 text-blue-600 font-bold'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-blue-600' : 'text-stone-400'} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Terminal Mode Toggle */}
      <div className="border-t border-stone-100 pt-3 px-2 mb-3">
        <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-stone-700">Active Terminal</p>
            <p className="text-[10px] text-stone-400">Receive scan popups</p>
          </div>
          <input
            type="checkbox"
            defaultChecked={typeof window !== 'undefined' ? localStorage.getItem('active_terminal') === 'true' : false}
            onChange={(e) => {
              localStorage.setItem('active_terminal', e.target.checked ? 'true' : 'false');
            }}
            className="w-4 h-4 text-blue-600 rounded accent-blue-600 cursor-pointer"
          />
        </div>
      </div>

      {/* User Profile & Logout Button */}
      <div className="border-t border-stone-100 pt-4 px-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-stone-200 bg-stone-100 flex items-center justify-center font-bold text-xs text-stone-700">
              WH
            </div>
            <div>
              <p className="text-xs font-bold text-stone-900 leading-tight">Warehouse Admin</p>
              <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> System Ready
              </p>
            </div>
          </div>

          <button
            onClick={() => alert('Logged out')}
            title="Sign out"
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

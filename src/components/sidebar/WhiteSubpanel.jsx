'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Boxes,
  ClipboardCheck,
  Database,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowDownLeft,
  ArrowUpRight,
  Cpu,
  Wifi,
  Usb,
  Cable
} from 'lucide-react';
import { connectWebSerial } from '@/services/rfid/webSerialDriver';

export default function WhiteSubpanel({ isCollapsed, onToggle }) {
  const pathname = usePathname();
  const [rfidMode, setRfidMode] = useState('web_serial');
  const [usbConnected, setUsbConnected] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('rfid_input_mode') || 'web_serial';
      setRfidMode(savedMode);
    }
  }, []);

  const handleModeChange = (mode) => {
    setRfidMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rfid_input_mode', mode);
    }
  };

  const handleConnectUsb = async () => {
    const success = await connectWebSerial((uid) => {
      if (typeof window !== 'undefined' && window.triggerDirectScanUid) {
        window.triggerDirectScanUid(uid);
      }
    }, (err) => {
      alert('USB Serial Error: ' + err);
    });

    if (success) {
      setUsbConnected(true);
    }
  };

  const menus = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Inventory', href: '/inventory', icon: Boxes },
    { label: 'Stock Opname', href: '/stock-opname', icon: ClipboardCheck },
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

      {/* RFID Hardware Mode Selector */}
      <div className="border-t border-stone-100 pt-3 px-2 mb-2 space-y-2">
        <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1">
              <Cpu size={12} className="text-blue-600" /> RFID Hardware Mode
            </span>
            <input
              type="checkbox"
              defaultChecked={typeof window !== 'undefined' ? localStorage.getItem('active_terminal') !== 'false' : true}
              onChange={(e) => {
                localStorage.setItem('active_terminal', e.target.checked ? 'true' : 'false');
              }}
              title="Active Terminal Toggle"
              className="w-3.5 h-3.5 text-blue-600 rounded accent-blue-600 cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-3 gap-1 bg-stone-200/60 p-1 rounded-lg text-[10px] font-bold">
            <button
              onClick={() => handleModeChange('web_serial')}
              className={`py-1 rounded-md transition cursor-pointer flex items-center justify-center gap-1 ${
                rfidMode === 'web_serial' ? 'bg-white text-blue-600 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Direct USB Web Serial (Chrome/Edge)"
            >
              <Usb size={11} /> USB
            </button>
            <button
              onClick={() => handleModeChange('bridge')}
              className={`py-1 rounded-md transition cursor-pointer flex items-center justify-center gap-1 ${
                rfidMode === 'bridge' ? 'bg-white text-blue-600 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Node.js USB Bridge (bridge.js)"
            >
              <Cable size={11} /> Bridge
            </button>
            <button
              onClick={() => handleModeChange('wifi')}
              className={`py-1 rounded-md transition cursor-pointer flex items-center justify-center gap-1 ${
                rfidMode === 'wifi' ? 'bg-white text-blue-600 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
              }`}
              title="ESP32 Wi-Fi Standalone Reader"
            >
              <Wifi size={11} /> Wi-Fi
            </button>
          </div>

          {rfidMode === 'web_serial' && (
            <button
              onClick={handleConnectUsb}
              className={`w-full py-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                usbConnected
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs'
              }`}
            >
              <Usb size={12} /> {usbConnected ? '✅ USB RFID Connected' : '🔌 Connect USB RFID'}
            </button>
          )}
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

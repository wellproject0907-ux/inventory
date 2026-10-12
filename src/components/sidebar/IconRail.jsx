'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Boxes,
  ClipboardCheck,
  Database,
  Settings
} from 'lucide-react';
import styles from './IconRail.module.css';

export default function IconRail() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', title: 'Dashboard', icon: LayoutDashboard },
    { href: '/inventory', title: 'Stock & Items', icon: Boxes },
    { href: '/stock-opname', title: 'Stock Opname', icon: ClipboardCheck },
    { href: '/master-data', title: 'Master Data', icon: Database },
  ];

  return (
    <div className={styles.railContainer}>
      <div className="flex flex-col items-center gap-5">
        <Link href="/" title="Inventory Home" className={styles.brandLogo}>
          INV
        </Link>

        <div className={styles.navSection}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.title}
                className={`${styles.navItem} ${isActive ? styles.activeNavItem : ''}`}
              >
                <Icon size={20} />
              </Link>
            );
          })}
        </div>
      </div>

      <div className={styles.bottomActions}>
        <button className={styles.actionButton} title="Settings">
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
}

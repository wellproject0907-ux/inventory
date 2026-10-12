'use client';

import styles from './InventoryAlerts.module.css';

export default function InventoryAlerts({ metrics = { inStock: 0, lowStock: 0, outOfStock: 0, totalProducts: 0 }, selectedFilter, onSelectFilter }) {
  const total = metrics.totalProducts || 1;
  const inStockPct = Math.round((metrics.inStock / total) * 100);

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Inventory Alerts</h3>

      <div className={styles.chartWrapper}>
        <svg className={styles.donutSvg} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="38" fill="none" stroke="#e2e8f0" strokeWidth="12" />
        </svg>
        <div className={styles.donutCenter}>
          <span className="text-xs font-bold text-stone-800">{inStockPct}%</span>
        </div>
      </div>

      <div className={styles.legendGrid}>
        <div
          className={`${styles.legendItem} ${selectedFilter === 'in' ? styles.legendItemActive : ''}`}
          onClick={() => onSelectFilter('in')}
        >
          <div className="flex items-center gap-1.5 justify-center">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-xs text-stone-600">In Stock</span>
          </div>
          <span className="text-xs font-bold text-stone-900 mt-0.5 block">{metrics.inStock}</span>
        </div>
        <div
          className={`${styles.legendItem} ${selectedFilter === 'low' ? styles.legendItemActive : ''}`}
          onClick={() => onSelectFilter('low')}
        >
          <div className="flex items-center gap-1.5 justify-center">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            <span className="text-xs text-stone-600">Low Stock</span>
          </div>
          <span className="text-xs font-bold text-stone-900 mt-0.5 block">{metrics.lowStock}</span>
        </div>
        <div
          className={`${styles.legendItem} ${selectedFilter === 'out' ? styles.legendItemActive : ''}`}
          onClick={() => onSelectFilter('out')}
        >
          <div className="flex items-center gap-1.5 justify-center">
            <span className="w-2 h-2 rounded-full bg-slate-300"></span>
            <span className="text-xs text-stone-600">Out of Stock</span>
          </div>
          <span className="text-xs font-bold text-stone-900 mt-0.5 block">{metrics.outOfStock}</span>
        </div>
      </div>
    </div>
  );
}

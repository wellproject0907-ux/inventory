import styles from './InventoryAlerts.module.css';

export default function InventoryAlerts() {
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Inventory Alerts</h3>

      <div className={styles.chartWrapper}>
        <svg className={styles.donutSvg} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="38" fill="none" stroke="#e2e8f0" strokeWidth="12" />
          <circle cx="50" cy="50" r="38" fill="none" stroke="#34d399" strokeWidth="12" strokeDasharray="238.7" strokeDashoffset="64" />
          <circle cx="50" cy="50" r="38" fill="none" stroke="#f87171" strokeWidth="12" strokeDasharray="238.7" strokeDashoffset="193" />
          <circle cx="50" cy="50" r="38" fill="none" stroke="#cbd5e1" strokeWidth="12" strokeDasharray="238.7" strokeDashoffset="220" />
        </svg>
        <div className={styles.donutCenter}>
          <span className="text-xs font-bold text-stone-800">Alerts</span>
        </div>
        <span className="absolute top-10 right-14 text-[10px] font-bold text-stone-500">8%</span>
        <span className="absolute top-20 right-6 text-[10px] font-bold text-stone-500">19%</span>
        <span className="absolute bottom-10 left-16 text-[10px] font-bold text-stone-500">73%</span>
      </div>

      <div className={styles.legendGrid}>
        <div className={styles.legendItem}>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-xs text-stone-600">In Stock</span>
          </div>
          <span className="text-xs font-bold text-stone-900 mt-1 block">2880</span>
        </div>
        <div className={styles.legendItem}>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            <span className="text-xs text-stone-600">Low Stock</span>
          </div>
          <span className="text-xs font-bold text-stone-900 mt-1 block">510</span>
        </div>
        <div className={styles.legendItem}>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-300"></span>
            <span className="text-xs text-stone-600">Out of Stock</span>
          </div>
          <span className="text-xs font-bold text-stone-900 mt-1 block">374</span>
        </div>
      </div>
    </div>
  );
}

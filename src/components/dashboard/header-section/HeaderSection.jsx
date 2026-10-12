import { Search, Bell } from 'lucide-react';
import styles from './HeaderSection.module.css';

export default function HeaderSection() {
  return (
    <header className={styles.header}>
      <div>
        {/* Greeting removed */}
      </div>
      <div className={styles.actions}>
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search Products / SKU..."
            className={styles.searchInput}
          />
        </div>
        <button className={styles.notificationBtn} title="Notifications">
          <Bell size={18} />
          <span className={styles.notificationBadge}>3</span>
        </button>
      </div>
    </header>
  );
}

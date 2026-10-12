'use client';

import { useState } from 'react';
import IconRail from './sidebar/IconRail';
import WhiteSubpanel from './sidebar/WhiteSubpanel';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={styles.sidebarWrapper}>
      <IconRail />
      <WhiteSubpanel isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
    </div>
  );
}

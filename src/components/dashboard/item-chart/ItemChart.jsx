'use client';

import { useState } from 'react';
import styles from './ItemChart.module.css';

export default function ItemChart() {
  const [selectedMonth, setSelectedMonth] = useState('Jul');
  const [tooltipPos, setTooltipPos] = useState({ x: 150, y: 10 });

  const currentData = [
    { month: 'Jan', inbound: 0, outbound: 0, yearIn: 0, yearOut: 0 },
    { month: 'Feb', inbound: 0, outbound: 0, yearIn: 0, yearOut: 0 },
    { month: 'Mar', inbound: 0, outbound: 0, yearIn: 0, yearOut: 0 },
    { month: 'Apr', inbound: 0, outbound: 0, yearIn: 0, yearOut: 0 },
    { month: 'May', inbound: 0, outbound: 0, yearIn: 0, yearOut: 0 },
    { month: 'Jun', inbound: 0, outbound: 0, yearIn: 0, yearOut: 0 },
    { month: 'Jul', inbound: 0, outbound: 0, yearIn: 0, yearOut: 0 },
    { month: 'Aug', inbound: 0, outbound: 0, yearIn: 0, yearOut: 0 },
    { month: 'Sep', inbound: 0, outbound: 0, yearIn: 0, yearOut: 0 },
    { month: 'Oct', inbound: 0, outbound: 0, yearIn: 0, yearOut: 0 },
    { month: 'Nov', inbound: 0, outbound: 0, yearIn: 0, yearOut: 0 },
    { month: 'Dec', inbound: 0, outbound: 0, yearIn: 0, yearOut: 0 },
  ];

  const currentItem = currentData.find(d => d.month === selectedMonth) || currentData[6];

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setTooltipPos({
      x: Math.max(10, Math.min(x - 70, rect.width - 180)),
      y: 5
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Item Analytics</h3>
          <p className={styles.subtitle}>Inbound vs Outbound movements</p>
        </div>

        <div className={styles.legendRow}>
          <div className="flex items-center gap-1.5">
            <span className={styles.legendInboundBox}></span>
            <span className="text-xs text-stone-700">Inbound</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={styles.legendOutboundBox}></span>
            <span className="text-xs text-stone-700">Outbound</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={styles.legendPreviousBox}></span>
            <span className="text-xs text-stone-700">Same month a year earlier</span>
          </div>
        </div>
      </div>

      <div
        className={styles.chartArea}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setSelectedMonth(null)}
      >
        {selectedMonth && currentItem && (
          <div
            className={styles.tooltipBox}
            style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
          >
            <div className="text-[11px] font-bold text-stone-800 mb-0.5">Period: {selectedMonth}</div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <span className="text-[11px] text-stone-600">Inbound:</span>
              <span className="text-[11px] font-bold text-stone-900">{currentItem.inbound} / {currentItem.yearIn} units</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              <span className="text-[11px] text-stone-600">Outbound:</span>
              <span className="text-[11px] font-bold text-stone-900">{currentItem.outbound} / {currentItem.yearOut} units</span>
            </div>
          </div>
        )}

        <div className={styles.barsContainer}>
          {currentData.map((item) => {
            const isSelected = item.month === selectedMonth;
            const maxVal = 1500;
            const inHeight = (item.inbound / maxVal) * 100;
            const outHeight = (item.outbound / maxVal) * 100;
            const yearEarlierVal = Math.max(item.yearIn, item.yearOut);
            const prevHeight = (yearEarlierVal / maxVal) * 100;

            return (
              <div
                key={item.month}
                className={styles.barGroup}
                onMouseEnter={() => setSelectedMonth(item.month)}
                onClick={() => setSelectedMonth(item.month)}
                style={{ cursor: 'pointer' }}
              >
                <div className={styles.barStackParent}>
                  <div
                    className={`${styles.barYearEarlier} ${isSelected ? styles.barYearEarlierActive : ''}`}
                    style={{ height: `${prevHeight}%` }}
                  ></div>
                  <div className={styles.barsWrapper}>
                    <div className={`${styles.barOutbound} ${isSelected ? styles.barActive : ''}`} style={{ height: `${outHeight}%` }}></div>
                    <div className={`${styles.barInbound} ${isSelected ? styles.barActive : ''}`} style={{ height: `${inHeight}%` }}></div>
                  </div>
                </div>
                <span className={`${styles.monthLabel} ${isSelected ? styles.monthLabelActive : ''}`}>
                  {item.month}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

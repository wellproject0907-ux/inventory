'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './PerformanceFilter.module.css';

export default function PerformanceFilter() {
  const [viewMode, setViewMode] = useState('Month');
  const [currentDate, setCurrentDate] = useState('Nov 2025');
  const [comparePrevious, setComparePrevious] = useState(false);
  const [compareYearAgo, setCompareYearAgo] = useState(true);

  return (
    <div className={styles.container}>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Month / Quarter / Year Tabs */}
        <div className={styles.tabsContainer}>
          {['Month', 'Quarter', 'Year'].map((mode) => (
            <button
              key={mode}
              className={`${styles.tabBtn} ${viewMode === mode ? styles.tabActive : ''}`}
              onClick={() => setViewMode(mode)}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Period navigation & comparison options */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center bg-white border border-stone-200 rounded-xl p-1 shadow-2xs">
            <button className="p-1 rounded-lg hover:bg-stone-100 text-stone-600 transition">
              <ChevronLeft size={14} />
            </button>
            <span className="px-3 font-semibold text-stone-900">{currentDate}</span>
            <button className="p-1 rounded-lg hover:bg-stone-100 text-stone-600 transition">
              <ChevronRight size={14} />
            </button>
          </div>

          <span className="text-stone-400 font-medium">Compare with</span>

          <label className="flex items-center gap-2 cursor-pointer select-none text-stone-700">
            <input
              type="checkbox"
              checked={comparePrevious}
              onChange={() => setComparePrevious(!comparePrevious)}
              className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 accent-amber-600"
            />
            <span className="text-xs">previous period (Oct 2025)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none text-stone-700">
            <input
              type="checkbox"
              checked={compareYearAgo}
              onChange={() => setCompareYearAgo(!compareYearAgo)}
              className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 accent-amber-600"
            />
            <span className="text-xs">same period a year earlier (Nov 2024)</span>
          </label>
        </div>
      </div>
    </div>
  );
}

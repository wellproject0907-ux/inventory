'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import styles from './MetricCards.module.css';

export default function MetricCards({ metrics = { totalProducts: 0, inStock: 0, lowStock: 0, outOfStock: 0 }, selectedFilter, onSelectFilter }) {
  const [expandedCard, setExpandedCard] = useState(null);

  const cards = [
    { title: 'Total Products', value: metrics.totalProducts.toLocaleString(), change: '+0%', positive: true, filterKey: 'all' },
    { title: 'In Stock', value: metrics.inStock.toLocaleString(), change: '+0%', positive: true, filterKey: 'in' },
    { title: 'Low Stock', value: metrics.lowStock.toLocaleString(), change: '0%', positive: false, filterKey: 'low' },
    { title: 'Out of Stock', value: metrics.outOfStock.toLocaleString(), change: '0%', positive: false, filterKey: 'out' },
  ];

  const toggleDetails = (e, idx) => {
    e.stopPropagation();
    setExpandedCard(expandedCard === idx ? null : idx);
  };

  return (
    <div className={styles.grid}>
      {cards.map((card, idx) => {
        const isSelected = selectedFilter === card.filterKey;
        const isExpanded = expandedCard === idx;

        return (
          <div key={idx} className="relative">
            <div
              className={`${styles.card} ${isSelected ? styles.cardActive : ''}`}
              onClick={() => onSelectFilter(card.filterKey)}
              title={`Click to filter by ${card.title}`}
            >
              <div className={styles.cardTop}>
                <span className={styles.cardTitle}>{card.title}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    className={styles.detailsBtn}
                    onClick={(e) => toggleDetails(e, idx)}
                  >
                    Details {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>
                  <span className={`${styles.badge} ${card.positive ? styles.badgeGreen : styles.badgeRed}`}>
                    {card.change}
                  </span>
                </div>
              </div>
              <p className={styles.cardValue}>{card.value}</p>
            </div>

            {isExpanded && (
              <div className={styles.dropdownPanel}>
                <div className={styles.panelHeader}>
                  <span className={styles.panelTitle}>{card.title.toUpperCase()} BREAKDOWN</span>
                  <button onClick={(e) => { e.stopPropagation(); setExpandedCard(null); }} className={styles.closeBtn}>
                    <X size={14} />
                  </button>
                </div>
                <p className="text-xs text-stone-400 py-1 text-center">Live from Firestore</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

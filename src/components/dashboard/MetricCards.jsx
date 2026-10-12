import styles from './MetricCards.module.css';

export default function MetricCards() {
  const cards = [
    { title: 'Total Products', value: '13,284', change: '+8.4%', positive: true },
    { title: 'In Stock', value: '1,102', change: '+3.2%', positive: true },
    { title: 'Low Stock', value: '2,496', change: '-2.8%', positive: false },
    { title: 'Out of Stock', value: '345', change: '-1.6%', positive: false },
  ];

  return (
    <div className={styles.grid}>
      {cards.map((card, idx) => (
        <div key={idx} className={styles.card}>
          <div className={styles.cardTop}>
            <span className={styles.cardTitle}>{card.title}</span>
            <span className={`${styles.badge} ${card.positive ? styles.badgeGreen : styles.badgeRed}`}>
              {card.change}
            </span>
          </div>
          <p className={styles.cardValue}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}

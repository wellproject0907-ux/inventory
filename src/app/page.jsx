'use client';

import { useState, useEffect } from 'react';
import PerformanceFilter from '@/components/dashboard/performance-filter/PerformanceFilter';
import MetricCards from '@/components/dashboard/metric-cards/MetricCards';
import ItemChart from '@/components/dashboard/item-chart/ItemChart';
import InventoryAlerts from '@/components/dashboard/inventory-alerts/InventoryAlerts';
import ProductInventoryTable from '@/components/dashboard/product-table/ProductInventoryTable';
import { subscribeToInventory, calculateMetrics } from '@/services/firebase/inventoryService';

export default function DashboardPage() {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [inventoryItems, setInventoryItems] = useState([]);
  const [metrics, setMetrics] = useState({ totalProducts: 0, inStock: 0, lowStock: 0, outOfStock: 0 });

  useEffect(() => {
    const unsubscribe = subscribeToInventory((items) => {
      setInventoryItems(items);
      setMetrics(calculateMetrics(items));
    });
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  return (
    <div className="w-full">
      <PerformanceFilter />
      <MetricCards metrics={metrics} selectedFilter={selectedFilter} onSelectFilter={setSelectedFilter} />

      <div className="flex flex-col lg:flex-row gap-4 mb-4">
        <ItemChart />
        <InventoryAlerts metrics={metrics} selectedFilter={selectedFilter} onSelectFilter={setSelectedFilter} />
      </div>

      <ProductInventoryTable products={inventoryItems} selectedFilter={selectedFilter} onSelectFilter={setSelectedFilter} />
    </div>
  );
}

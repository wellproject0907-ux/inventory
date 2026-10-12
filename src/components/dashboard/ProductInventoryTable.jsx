'use client';

import { useState } from 'react';
import { Filter, ChevronDown, MoreVertical, Edit3, ArrowUpDown, Check } from 'lucide-react';
import styles from './ProductInventoryTable.module.css';

export default function ProductInventoryTable() {
  const initialProducts = [
    {
      name: 'Wireless Headphones',
      sku: 'HP-401',
      category: 'Electronics',
      location: 'Warehouse A',
      stockIn: 150,
      stockOut: 45,
      units: 1245,
      status: 'Low Stock',
      statusType: 'low',
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100&auto=format&fit=crop&q=80',
    },
    {
      name: "Women's Pleated Dress",
      sku: 'HB-552',
      category: 'Apparel',
      location: 'Warehouse B',
      stockIn: 80,
      stockOut: 20,
      units: 346,
      status: 'In Stock',
      statusType: 'in',
      image: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=100&auto=format&fit=crop&q=80',
    },
    {
      name: 'Leather Handbag',
      sku: 'WD-218',
      category: 'Accessories',
      location: 'Warehouse C',
      stockIn: 30,
      stockOut: 15,
      units: 102,
      status: 'Out of stock',
      statusType: 'out',
      image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=100&auto=format&fit=crop&q=80',
    },
    {
      name: 'Graphic Sweatshirt',
      sku: 'SW-309',
      category: 'Apparel',
      location: 'Warehouse D',
      stockIn: 100,
      stockOut: 60,
      units: 246,
      status: 'In Stock',
      statusType: 'in',
      image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=100&auto=format&fit=crop&q=80',
    },
    {
      name: 'Kids Party Dress',
      sku: 'KD-114',
      category: 'Apparel',
      location: 'Warehouse E',
      stockIn: 200,
      stockOut: 90,
      units: 708,
      status: 'Low Stock',
      statusType: 'low',
      image: 'https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=100&auto=format&fit=crop&q=80',
    },
  ];

  const [products, setProducts] = useState(initialProducts);
  const [sortKey, setSortKey] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortKey === key && sortDirection === 'asc') {
      direction = 'desc';
    }
    setSortKey(key);
    setSortDirection(direction);

    const sorted = [...products].sort((a, b) => {
      let aVal = a[key];
      let bVal = b[key];
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setProducts(sorted);
  };

  const handleFilterSelect = (statusType) => {
    setSelectedFilter(statusType);
    setIsFilterOpen(false);
  };

  const handleSeeAll = () => {
    setSelectedFilter('all');
    setProducts(initialProducts);
  };

  const filteredProducts = products.filter((item) => {
    if (selectedFilter === 'all') return true;
    return item.statusType === selectedFilter;
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Product Inventory</h3>
        <div className={styles.actions}>
          <div className="relative">
            <button
              className={styles.filterBtn}
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <Filter size={14} />
              <span>Filter {selectedFilter !== 'all' ? `(${selectedFilter})` : ''}</span>
              <ChevronDown size={14} />
            </button>

            {isFilterOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white border border-stone-200 rounded-xl shadow-lg py-1.5 z-20">
                <button
                  className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-stone-50 ${selectedFilter === 'all' ? 'font-bold text-indigo-600' : 'text-stone-700'}`}
                  onClick={() => handleFilterSelect('all')}
                >
                  <span>All Status</span>
                  {selectedFilter === 'all' && <Check size={14} />}
                </button>
                <button
                  className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-stone-50 ${selectedFilter === 'in' ? 'font-bold text-indigo-600' : 'text-stone-700'}`}
                  onClick={() => handleFilterSelect('in')}
                >
                  <span>In Stock</span>
                  {selectedFilter === 'in' && <Check size={14} />}
                </button>
                <button
                  className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-stone-50 ${selectedFilter === 'low' ? 'font-bold text-indigo-600' : 'text-stone-700'}`}
                  onClick={() => handleFilterSelect('low')}
                >
                  <span>Low Stock</span>
                  {selectedFilter === 'low' && <Check size={14} />}
                </button>
                <button
                  className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-stone-50 ${selectedFilter === 'out' ? 'font-bold text-indigo-600' : 'text-stone-700'}`}
                  onClick={() => handleFilterSelect('out')}
                >
                  <span>Out of Stock</span>
                  {selectedFilter === 'out' && <Check size={14} />}
                </button>
              </div>
            )}
          </div>

          <button className={styles.seeAllBtn} onClick={handleSeeAll}>
            See All
          </button>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead className="sticky top-0 z-20 bg-[#f1f3f5] shadow-xs">
            <tr className={styles.thRow}>
              <th className={styles.thClickable} onClick={() => handleSort('name')}>
                <div className="flex items-center gap-1.5">Name <ArrowUpDown size={12} /></div>
              </th>
              <th className={styles.thClickable} onClick={() => handleSort('sku')}>
                <div className="flex items-center gap-1.5">SKU <ArrowUpDown size={12} /></div>
              </th>
              <th className={styles.thClickable} onClick={() => handleSort('category')}>
                <div className="flex items-center gap-1.5">Category <ArrowUpDown size={12} /></div>
              </th>
              <th className={styles.thClickable} onClick={() => handleSort('location')}>
                <div className="flex items-center gap-1.5">Location <ArrowUpDown size={12} /></div>
              </th>
              <th className={styles.thClickable} onClick={() => handleSort('stockIn')}>
                <div className="flex items-center gap-1.5 text-emerald-600">Stock In <ArrowUpDown size={12} /></div>
              </th>
              <th className={styles.thClickable} onClick={() => handleSort('stockOut')}>
                <div className="flex items-center gap-1.5 text-rose-600">Stock Out <ArrowUpDown size={12} /></div>
              </th>
              <th className={styles.thClickable} onClick={() => handleSort('units')}>
                <div className="flex items-center gap-1.5">Units <ArrowUpDown size={12} /></div>
              </th>
              <th className={styles.thClickable} onClick={() => handleSort('status')}>
                <div className="flex items-center gap-1.5">Status <ArrowUpDown size={12} /></div>
              </th>
              <th className={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center py-6 text-xs text-stone-400">
                  No products found for this filter.
                </td>
              </tr>
            ) : (
              filteredProducts.map((item, idx) => (
                <tr key={idx} className={styles.tr}>
                  <td className={styles.tdName}>
                    <div className="flex items-center gap-3">
                      <img src={item.image} alt={item.name} className={styles.productImg} />
                      <span className="font-semibold text-stone-900">{item.name}</span>
                    </div>
                  </td>
                  <td className={styles.td}>{item.sku}</td>
                  <td className={styles.td}>{item.category}</td>
                  <td className={styles.td}>{item.location}</td>
                  <td className={styles.td}>
                    <span className="text-emerald-600 font-medium">+{item.stockIn}</span>
                  </td>
                  <td className={styles.td}>
                    <span className="text-rose-600 font-medium">-{item.stockOut}</span>
                  </td>
                  <td className={styles.td}>
                    <span className="font-bold text-stone-900">{item.units}</span>
                  </td>
                  <td className={styles.td}>
                    <span className={`
                      ${styles.statusBadge}
                      ${item.statusType === 'in' ? styles.statusIn : ''}
                      ${item.statusType === 'low' ? styles.statusLow : ''}
                      ${item.statusType === 'out' ? styles.statusOut : ''}
                    `}>
                      {item.status}
                    </span>
                  </td>
                  <td className={styles.tdAction}>
                    <button className={styles.actionIconBtn} title="Edit">
                      <Edit3 size={14} />
                    </button>
                    <button className={styles.actionIconBtn} title="More">
                      <MoreVertical size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

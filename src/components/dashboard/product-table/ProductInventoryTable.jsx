'use client';

import { useState } from 'react';
import { Search, Filter, ChevronDown, ArrowUpDown, Check, ArrowDownLeft, ArrowUpRight, Clock, User } from 'lucide-react';
import styles from './ProductInventoryTable.module.css';

export default function ProductInventoryTable({ products = [], selectedFilter, onSelectFilter }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortKey === key && sortDirection === 'asc') {
      direction = 'desc';
    }
    setSortKey(key);
    setSortDirection(direction);
  };

  const handleFilterSelect = (statusType) => {
    onSelectFilter(statusType);
    setIsFilterOpen(false);
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '-';
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) {
      return '-';
    }
  };

  const processedProducts = products.map(item => {
    const isCompleted = item.is_completed || item.lifecycle === 'COMPLETED';
    let status = isCompleted ? 'Completed (Out)' : 'Active (In Stock)';
    let statusType = isCompleted ? 'out' : 'in';

    return {
      ...item,
      name: item.nama_barang || 'Unnamed Item',
      sku: item.sku || '-',
      uid: item.nfc_uid || '-',
      category: item.kategori || 'General',
      status,
      statusType,
    };
  });

  const filteredProducts = processedProducts.filter((item) => {
    const matchesStatus = selectedFilter === 'all' || item.statusType === selectedFilter;
    const matchesSearch = !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.uid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.no_sj && item.no_sj.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.no_spk && item.no_spk.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <h3 className={styles.title}>Inventory Items (In & Out Tracking)</h3>

          <div className={styles.searchBox}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search SKU, Name, UID, No. SJ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>

        <div className={styles.actions}>
          <div className="relative">
            <button
              className={styles.filterBtn}
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <Filter size={14} />
              <span>Filter</span>
              <ChevronDown size={14} />
            </button>

            {isFilterOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white border border-stone-200 rounded-xl shadow-lg py-1.5 z-20">
                <button
                  className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-stone-50 ${selectedFilter === 'all' ? 'font-bold text-indigo-600' : 'text-stone-700'}`}
                  onClick={() => handleFilterSelect('all')}
                >
                  <span>All Items</span>
                  {selectedFilter === 'all' && <Check size={14} />}
                </button>
                <button
                  className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-stone-50 ${selectedFilter === 'in' ? 'font-bold text-indigo-600' : 'text-stone-700'}`}
                  onClick={() => handleFilterSelect('in')}
                >
                  <span>Active (In)</span>
                  {selectedFilter === 'in' && <Check size={14} />}
                </button>
                <button
                  className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-stone-50 ${selectedFilter === 'out' ? 'font-bold text-indigo-600' : 'text-stone-700'}`}
                  onClick={() => handleFilterSelect('out')}
                >
                  <span>Completed (Out)</span>
                  {selectedFilter === 'out' && <Check size={14} />}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead className="sticky top-0 z-20 bg-stone-50 shadow-xs">
            <tr className={styles.thRow}>
              <th className={styles.th}>SKU & UID</th>
              <th className={styles.th}>Name</th>
              <th className="p-3.5 text-emerald-700 bg-emerald-50/50">Scan IN</th>
              <th className="p-3.5 text-amber-700 bg-amber-50/50">Scan OUT</th>
              <th className={styles.th}>Login User</th>
              <th className="p-3.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-xs text-stone-400">
                  No inventory records found. Scan RFID cards to see them here.
                </td>
              </tr>
            ) : (
              filteredProducts.map((item, idx) => (
                <tr key={item.id || idx} className={styles.tr}>
                  <td className={styles.td}>
                    <p className="font-mono font-bold text-blue-600">{item.sku}</p>
                    <p className="text-[10px] text-stone-400 font-mono">UID: {item.uid}</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">
                      SJ: <span className="font-mono text-stone-700">{item.no_sj || '-'}</span> | SPK: <span className="font-mono text-stone-700">{item.no_spk || '-'}</span>
                    </p>
                  </td>
                  <td className={styles.tdName}>
                    <span className="font-semibold text-stone-900">{item.name}</span>
                    <span className="block text-[10px] text-stone-400">Supplier: {item.category}</span>
                  </td>
                  {/* Scan IN Column */}
                  <td className="p-3.5 bg-emerald-50/30">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-medium text-xs">
                      <ArrowDownLeft size={14} className="text-emerald-600 shrink-0" />
                      <span>Qty: 1</span>
                    </div>
                    <p className="text-[10px] text-stone-500 mt-0.5 flex items-center gap-1">
                      <Clock size={11} /> {formatTimestamp(item.scan_in_at)}
                    </p>
                  </td>
                  {/* Scan OUT Column */}
                  <td className="p-3.5 bg-amber-50/30">
                    {item.scan_out_at ? (
                      <>
                        <div className="flex items-center gap-1.5 text-amber-800 font-medium text-xs">
                          <ArrowUpRight size={14} className="text-amber-600 shrink-0" />
                          <span>Qty: 1</span>
                        </div>
                        <p className="text-[10px] text-stone-500 mt-0.5 flex items-center gap-1">
                          <Clock size={11} /> {formatTimestamp(item.scan_out_at)}
                        </p>
                      </>
                    ) : (
                      <span className="text-stone-400 italic text-[11px]">Not Out</span>
                    )}
                  </td>
                  <td className={styles.td}>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                      <User size={11} /> Warehouse Admin
                    </span>
                  </td>
                  <td className="p-3.5 text-center">
                    <span className={`
                      ${styles.statusBadge}
                      ${item.statusType === 'in' ? styles.statusIn : styles.statusOut}
                    `}>
                      {item.status}
                    </span>
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

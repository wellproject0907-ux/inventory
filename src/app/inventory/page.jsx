'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/services/firebase/config';
import { collection, getDocs, query, orderBy, doc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { Boxes, Search, User, Clock, RefreshCw, Scan, FileSpreadsheet, CheckCircle2, AlertCircle, PackageCheck, ChevronRight, X, Layers, Trash2 } from 'lucide-react';
import { CapacitorNfc } from '@capgo/capacitor-nfc';
import * as XLSX from 'xlsx';

export default function StockOpnamePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [scannedResult, setScannedResult] = useState(null);
  const [scanInput, setScanInput] = useState('');
  const [expandedKeys, setExpandedKeys] = useState({}); // For inline accordion dropdown

  const fetchOpnameData = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'barang'), orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setItems(data);
    } catch (err) {
      console.error('Error fetching inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpnameData();
    fetch('/api/system-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'INVENTORY' })
    }).catch(err => console.log('Failed to set mode:', err));

    // Listen to real-time hardware scans
    const unsubscribe = onSnapshot(doc(db, 'system', 'settings'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.last_scanned_uid) {
          const scannedAt = data.last_scanned_at?.toMillis ? data.last_scanned_at.toMillis() : 0;
          if (Date.now() - scannedAt < 10000) {
            handleExternalScan(data.last_scanned_uid);
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const [highlightedUid, setHighlightedUid] = useState(null);

  const handleExternalScan = (uid) => {
    const queryStr = String(uid).trim().toLowerCase();
    const found = items.find(item =>
      (item.id && item.id.toLowerCase() === queryStr) ||
      (item.nfc_uid && item.nfc_uid.toLowerCase() === queryStr) ||
      (item.sku && item.sku.toLowerCase().includes(queryStr)) ||
      (item.nama_barang && item.nama_barang.toLowerCase().includes(queryStr))
    );

    if (found) {
      setScannedResult({ found: true, data: found });
      setHighlightedUid(found.nfc_uid);
      const groupKey = (found.nama_barang || 'Unnamed Material').trim().toLowerCase();
      setExpandedKeys(prev => ({ ...prev, [groupKey]: true }));
      setTimeout(() => setHighlightedUid(null), 4000);
    } else {
      setScannedResult({ found: false, query: uid });
    }
  };

  const handleAuditScan = (e) => {
    e.preventDefault();
    const queryStr = scanInput.trim().toLowerCase();
    if (!queryStr) return;

    const found = items.find(item =>
      (item.id && item.id.toLowerCase() === queryStr) ||
      (item.nfc_uid && item.nfc_uid.toLowerCase() === queryStr) ||
      (item.sku && item.sku.toLowerCase().includes(queryStr)) ||
      (item.nama_barang && item.nama_barang.toLowerCase().includes(queryStr)) ||
      (item.no_sj && item.no_sj.toLowerCase().includes(queryStr)) ||
      (item.no_spk && item.no_spk.toLowerCase().includes(queryStr))
    );

    if (found) {
      setScannedResult({ found: true, data: found });
    } else {
      setScannedResult({ found: false, query: scanInput });
    }
    setScanInput('');
  };

  const exportToExcel = () => {
    if (items.length === 0) {
      alert('No data to export.');
      return;
    }

    const exportData = items.map((item, index) => ({
      No: index + 1,
      SKU: item.sku || '-',
      UID: item.nfc_uid || '-',
      'Material Name': item.nama_barang || '-',
      Supplier: item.kategori || '-',
      'SJ No.': item.no_sj || '-',
      'SPK No.': item.no_spk || '-',
      'Inbound Time (IN)': formatTimestamp(item.scan_in_at),
      'Outbound Time (OUT)': formatTimestamp(item.scan_out_at),
      'Warehouse Status': item.is_completed || item.lifecycle === 'COMPLETED' ? 'CHECKED OUT (COMPLETED)' : 'IN WAREHOUSE (ACTIVE IN)',
      'Warehouse User': item.warehouse_user || 'Warehouse Admin'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
    XLSX.writeFile(workbook, `Inventory_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '-';
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) {
      return '-';
    }
  };

  const handleDeleteItem = async (id, nama, uid) => {
    if (confirm(`Delete item "${nama}" (UID: ${uid})? Data will be deleted and NTAG card erased for reuse.`)) {
      try {
        await deleteDoc(doc(db, 'barang', String(id)));
        try {
          await CapacitorNfc.erase();
        } catch (e) {}
        fetchOpnameData();
      } catch (err) {
        alert('Failed to delete item: ' + err.message);
      }
    }
  };

  const filteredItems = items.filter(item =>
    (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.nfc_uid && item.nfc_uid.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.nama_barang && item.nama_barang.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.no_sj && item.no_sj.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.no_spk && item.no_spk.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Group items strictly by Material Name (nama_barang) so items with the same name combine into 1 row with accumulated QTY
  const groupedMap = {};
  filteredItems.forEach(item => {
    const rawName = (item.nama_barang || 'Unnamed Material').trim();
    const key = rawName.toLowerCase();
    if (!groupedMap[key]) {
      let baseSku = item.sku || '-';
      if (item.sku && item.sku.includes('-')) {
        const parts = item.sku.split('-');
        if (parts.length > 1 && parts[parts.length - 1].length >= 4) {
          parts.pop();
          baseSku = parts.join('-');
        }
      }

      groupedMap[key] = {
        key,
        sku: baseSku,
        nama_barang: rawName,
        supplier: item.kategori || 'General',
        items: []
      };
    }
    groupedMap[key].items.push(item);
  });
  const groupedList = Object.values(groupedMap);

  const toggleExpand = (key) => {
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="w-full max-w-full space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <Boxes className="text-blue-600" size={24} /> Inventory Management
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">View grouped material inventory and individual UID breakdowns.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer shadow-sm"
          >
            <FileSpreadsheet size={16} /> Export to Excel (.xlsx)
          </button>
          <button
            onClick={fetchOpnameData}
            className="flex items-center gap-1.5 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold px-4 py-2 rounded-xl transition cursor-pointer"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Live Audit Scanner Input Box */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2">
          <PackageCheck className="text-blue-600" size={22} />
          <h3 className="text-sm font-bold text-stone-900">Scan / Check Warehouse Items</h3>
        </div>
        <p className="text-xs text-stone-500">
          Tap RFID card or enter SKU/UID/SJ No. to instantly check whether the item is <strong>in warehouse</strong> or <strong>checked out</strong>.
        </p>

        <form onSubmit={handleAuditScan} className="flex gap-2">
          <input
            type="text"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            placeholder="Scan or type SKU / UID / SJ No. to check..."
            className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-xs outline-none focus:border-blue-500 font-mono text-stone-900 font-bold"
            autoFocus
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-xl text-xs transition cursor-pointer"
          >
            Check Item Status
          </button>
        </form>

        {/* Scan Result Preview Box */}
        {scannedResult && (
          <div className={`p-4 rounded-xl border text-xs space-y-3 animate-fade-in ${
            scannedResult.found ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
          }`}>
            {scannedResult.found ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-sm">
                    <CheckCircle2 size={18} className="text-emerald-600" /> Item Verified in System!
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    scannedResult.data.is_completed || scannedResult.data.lifecycle === 'COMPLETED'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-emerald-600 text-white shadow-xs'
                  }`}>
                    {scannedResult.data.is_completed || scannedResult.data.lifecycle === 'COMPLETED' ? '⚠️ CHECKED OUT (COMPLETED)' : '✅ IN WAREHOUSE (ACTIVE IN)'}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-stone-700 bg-white/60 p-3 rounded-lg border border-emerald-100">
                  <div><span className="text-stone-400 block text-[10px]">SKU:</span><strong className="font-mono text-blue-600">{scannedResult.data.sku}</strong></div>
                  <div><span className="text-stone-400 block text-[10px]">Material Name:</span><strong className="text-stone-900">{scannedResult.data.nama_barang}</strong></div>
                  <div><span className="text-stone-400 block text-[10px]">Supplier:</span><span>{scannedResult.data.kategori || '-'}</span></div>
                  <div><span className="text-stone-400 block text-[10px]">Delivery Order (SJ) No.:</span><span className="font-mono font-semibold">{scannedResult.data.no_sj || '-'}</span></div>
                  <div><span className="text-stone-400 block text-[10px]">SPK (Out) No.:</span><span className="font-mono font-semibold">{scannedResult.data.no_spk || '-'}</span></div>
                  <div><span className="text-stone-400 block text-[10px]">Inbound Time (IN):</span><span>{formatTimestamp(scannedResult.data.scan_in_at)}</span></div>
                  <div><span className="text-stone-400 block text-[10px]">Outbound Time (OUT):</span><span>{formatTimestamp(scannedResult.data.scan_out_at)}</span></div>
                  <div><span className="text-stone-400 block text-[10px]">Warehouse User:</span><span>{scannedResult.data.warehouse_user || 'Warehouse Admin'}</span></div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 font-bold text-rose-800">
                <AlertCircle size={16} className="text-rose-600" /> Item with SKU / UID &quot;{scannedResult.query}&quot; not found in warehouse!
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grouped Inventory Table with Accordion Dropdown */}
      <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-blue-600" />
            <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">Grouped Material Inventory</h3>
          </div>
          <div className="relative flex-1 md:w-72">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-stone-400">
              <Search size={14} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search material groups..."
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-blue-500 text-stone-900"
            />
          </div>
        </div>

        <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-xs text-stone-400">Loading Inventory data...</div>
          ) : groupedList.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-400">No inventory data yet.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-20 bg-stone-50 shadow-xs">
                <tr className="bg-stone-50 border-b border-stone-100 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="p-3.5">Material Name & Base SKU</th>
                  <th className="p-3.5">Supplier</th>
                  <th className="p-3.5 text-center">Total Quantity (UIDs)</th>
                  <th className="p-3.5 text-center">Warehouse Status Summary</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs text-stone-800">
                {groupedList.map((group) => {
                  const totalQty = group.items.length;
                  const activeCount = group.items.filter(i => !i.is_completed && i.lifecycle !== 'COMPLETED').length;
                  const isExpanded = !!expandedKeys[group.key];

                  return (
                    <React.Fragment key={group.key}>
                      <tr
                        onClick={() => toggleExpand(group.key)}
                        className="hover:bg-blue-50/40 transition cursor-pointer select-none"
                      >
                        <td className="p-3.5">
                          <p className="font-bold text-stone-900 flex items-center gap-2">
                            <span>{group.nama_barang}</span>
                            <ChevronRight size={14} className={`text-stone-400 transition-transform ${isExpanded ? 'rotate-90 text-blue-600' : ''}`} />
                          </p>
                          <p className="font-mono text-[11px] text-blue-600">{group.sku}</p>
                        </td>
                        <td className="p-3.5 font-medium text-stone-700">{group.supplier}</td>
                        <td className="p-3.5 text-center">
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            {totalQty} UIDs / Items
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {activeCount} Active / {totalQty - activeCount} Completed
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleExpand(group.key); }}
                            className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-xl font-semibold text-xs transition inline-flex items-center gap-1 ml-auto cursor-pointer"
                          >
                            {isExpanded ? 'Hide UIDs' : 'View UIDs'} <ChevronRight size={14} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </button>
                        </td>
                      </tr>

                      {/* Accordion Dropdown Content (Turun ke bawah) */}
                      {isExpanded && (
                        <tr className="bg-stone-50/80 animate-fade-in">
                          <td colSpan="5" className="p-4">
                            <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3 shadow-inner">
                              <h4 className="text-[11px] font-bold text-stone-700 uppercase tracking-wider flex items-center gap-2">
                                <Layers size={14} className="text-blue-600" /> Individual UIDs Breakdown ({group.items.length})
                              </h4>
                              <div className="divide-y divide-stone-100 border border-stone-100 rounded-lg overflow-hidden">
                                {group.items.map((item) => {
                                  const isOut = item.is_completed || item.lifecycle === 'COMPLETED';
                                  const isHighlighted = item.nfc_uid === highlightedUid;
                                  return (
                                    <div key={item.id} className={`p-3 transition rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                                      isHighlighted ? 'bg-amber-100 border-2 border-amber-500 animate-pulse' : 'bg-stone-50/50 hover:bg-stone-50'
                                    }`}>
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <code className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">UID: {item.nfc_uid}</code>
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
                                            Qty: {item.stok ?? 1}
                                          </span>
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            isOut ? 'bg-amber-100 text-amber-800' : 'bg-emerald-600 text-white'
                                          }`}>
                                            {isOut ? 'CHECKED OUT' : 'IN WAREHOUSE'}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-stone-600 font-mono">
                                          SJ: <span className="font-semibold text-stone-800">{item.no_sj || '-'}</span> | SPK: <span className="font-semibold text-stone-800">{item.no_spk || '-'}</span>
                                        </p>
                                        <p className="text-[10px] text-stone-400 flex items-center gap-1">
                                          <Clock size={11} /> In: {formatTimestamp(item.scan_in_at)} {item.scan_out_at ? `| Out: ${formatTimestamp(item.scan_out_at)}` : ''}
                                        </p>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 text-stone-700 font-semibold text-[11px] bg-stone-100 px-3 py-1 rounded-full shrink-0">
                                          <User size={12} className="text-stone-500" /> {item.warehouse_user || 'Warehouse Admin'}
                                        </div>
                                        <button
                                          onClick={() => handleDeleteItem(item.id, item.nama_barang, item.nfc_uid)}
                                          className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-2.5 py-1.5 rounded-lg font-semibold text-xs transition cursor-pointer inline-flex items-center gap-1 shrink-0"
                                          title="Delete item and erase tag"
                                        >
                                          <Trash2 size={13} /> Delete & Erase
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

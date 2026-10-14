'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/services/firebase/config';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { subscribeToInventory } from '@/services/firebase/inventoryService';
import {
  ClipboardCheck,
  Search,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  PackageCheck,
  ChevronRight,
  Layers,
  Play,
  RotateCcw,
  Check,
  AlertTriangle,
  Clock,
  User
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function StockOpnamePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedKeys, setExpandedKeys] = useState({});
  const [highlightedUid, setHighlightedUid] = useState(null);

  // Stock Opname Audit Session State
  const [auditScannedUids, setAuditScannedUids] = useState(new Set());
  const [lastScannedInfo, setLastScannedInfo] = useState(null);
  const [scanInput, setScanInput] = useState('');
  const [showAllMaterials, setShowAllMaterials] = useState(false); // Default false: starts empty, populates as items are scanned

  const itemsRef = useRef([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const unsubscribe = subscribeToInventory((fetchedItems) => {
      // Filter active items in warehouse
      const activeItems = fetchedItems.filter(i => !i.is_completed && i.lifecycle !== 'COMPLETED' && Number(i.stok ?? 1) > 0);
      setItems(activeItems);
      setLoading(false);
    });

    // Set mode to OPNAME
    fetch('/api/system-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'OPNAME' })
    }).catch(err => console.log('Failed to set mode:', err));

    // Listen to real-time hardware scans
    const unsubSettings = onSnapshot(doc(db, 'system', 'settings'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.last_scanned_uid) {
          const scannedAt = data.last_scanned_at?.toMillis ? data.last_scanned_at.toMillis() : 0;
          if (Date.now() - scannedAt < 10000) {
            handleAuditScanUid(data.last_scanned_uid);
          }
        }
      }
    });

    if (typeof window !== 'undefined') {
      window.triggerStockOpnameScan = (uid) => handleAuditScanUid(uid);
    }

    return () => {
      unsubscribe();
      unsubSettings();
    };
  }, []);

  const handleAuditScanUid = (uid) => {
    const cleanUid = String(uid).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!cleanUid) return;

    // Add UID to Audit Session
    setAuditScannedUids(prev => {
      const next = new Set(prev);
      next.add(cleanUid);
      return next;
    });

    const currentItems = itemsRef.current;
    const found = currentItems.find(i =>
      String(i.nfc_uid || i.id).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanUid ||
      String(i.sku || '').toUpperCase().includes(cleanUid)
    );

    if (found) {
      setLastScannedInfo({ found: true, uid: cleanUid, item: found });
      setHighlightedUid(found.nfc_uid || found.id);
      const groupKey = (found.nama_barang || 'Unnamed Material').trim().toLowerCase();
      setExpandedKeys(prev => ({ ...prev, [groupKey]: true }));
    } else {
      setLastScannedInfo({ found: false, uid: cleanUid });
    }

    setTimeout(() => setHighlightedUid(null), 4000);
  };

  const handleManualScanSubmit = (e) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    handleAuditScanUid(scanInput.trim());
    setScanInput('');
  };

  const handleResetAuditSession = () => {
    if (confirm('Reset current Stock Opname audit scan session? Scanned physical counts will be reset to 0.')) {
      setAuditScannedUids(new Set());
      setLastScannedInfo(null);
    }
  };

  const filteredItems = items.filter(item =>
    (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.nfc_uid && item.nfc_uid.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.nama_barang && item.nama_barang.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.no_sj && item.no_sj.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Group items by Material Name
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

  // By default, filter to show ONLY material groups where AT LEAST 1 UID has been scanned in current session
  const groupedList = Object.values(groupedMap).filter(group => {
    if (showAllMaterials) return true;
    return group.items.some(i => auditScannedUids.has(String(i.nfc_uid || i.id).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()));
  });

  const toggleExpand = (key) => {
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const exportAuditToExcel = () => {
    if (groupedList.length === 0) {
      alert('No inventory data to export.');
      return;
    }

    const exportData = groupedList.map((group, index) => {
      const qtySystem = group.items.length;
      const qtyPhysical = group.items.filter(i => auditScannedUids.has(String(i.nfc_uid || i.id).replace(/[^a-zA-Z0-9]/g, '').toUpperCase())).length;
      const variance = qtyPhysical - qtySystem;

      let status = 'MATCH / SESUAI';
      if (variance < 0) status = `BARANG HILANG (${variance} Unit)`;
      else if (variance > 0) status = `BARANG LEBIH (+${variance} Unit)`;

      const missingUids = group.items
        .filter(i => !auditScannedUids.has(String(i.nfc_uid || i.id).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()))
        .map(i => i.nfc_uid || i.id)
        .join(', ');

      return {
        No: index + 1,
        'Base SKU': group.sku,
        'Material Name': group.nama_barang,
        Supplier: group.supplier,
        'Qty System (Inventory)': qtySystem,
        'Qty Physical (Audit Scan)': qtyPhysical,
        'Variance (Selisih)': variance,
        'Audit Status / Keterangan': status,
        'Missing UIDs (Barang Hilang)': missingUids || 'None'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Opname Audit');
    XLSX.writeFile(workbook, `Stock_Opname_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="w-full max-w-full space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 text-blue-600 font-semibold text-xs uppercase tracking-wider mb-1">
            <ClipboardCheck size={16} /> Physical Warehouse Audit
          </div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Stock Opname & Audit</h1>
          <p className="text-stone-500 text-sm mt-0.5">
            Reconcile System Inventory (Qty System) vs Physical RFID Scans (Qty Physical) in real-time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleResetAuditSession}
            className="flex items-center gap-1.5 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold px-4 py-2.5 rounded-xl transition cursor-pointer"
          >
            <RotateCcw size={14} /> Reset Audit Scan
          </button>
          <button
            onClick={exportAuditToExcel}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-sm"
          >
            <FileSpreadsheet size={16} /> Export Audit Report (.xlsx)
          </button>
        </div>
      </div>

      {/* Live Physical Audit Scan Input Box */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackageCheck className="text-blue-600" size={22} />
            <h3 className="text-sm font-bold text-stone-900">Real-time Physical Audit Scanner</h3>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            Audit Session Active: {auditScannedUids.size} Physical UIDs Scanned
          </span>
        </div>

        <form onSubmit={handleManualScanSubmit} className="flex gap-2">
          <input
            type="text"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            placeholder="Scan or type RFID UID to perform Stock Opname check..."
            className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500 font-mono text-stone-900 font-bold"
            autoFocus
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-sm"
          >
            Scan UID
          </button>
        </form>

        {/* Scan Status Toast Banner */}
        {lastScannedInfo && (
          <div className={`p-4 rounded-xl border text-xs space-y-2 animate-fade-in ${
            lastScannedInfo.found ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            {lastScannedInfo.found ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-emerald-800">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  <span>Physical Item Verified: <strong>{lastScannedInfo.item.nama_barang}</strong> (UID: <code className="font-mono text-blue-600">{lastScannedInfo.uid}</code>)</span>
                </div>
                <span className="text-[10px] font-bold uppercase bg-emerald-200 text-emerald-900 px-2.5 py-0.5 rounded-full">
                  Qty Physical +1
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 font-bold text-rose-800">
                <AlertCircle size={18} className="text-rose-600 shrink-0" />
                <span>Unrecorded Item Scanned: UID <code className="font-mono text-rose-700">{lastScannedInfo.uid}</code> is not registered in system inventory!</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stock Opname Reconciliation Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-stone-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Layers size={18} className="text-blue-600" />
            <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">Grouped Material Reconciliation</h3>
            <button
              type="button"
              onClick={() => setShowAllMaterials(prev => !prev)}
              className={`px-3 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer border ${
                showAllMaterials
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200'
              }`}
            >
              {showAllMaterials ? '📋 Showing All Materials' : '🔍 Audited Items Only (Default)'}
            </button>
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search material or SKU..."
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-blue-500 text-stone-900"
            />
          </div>
        </div>

        <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-xs text-stone-400">Loading Stock Opname data...</div>
          ) : groupedList.length === 0 ? (
            <div className="p-12 text-center text-xs text-stone-500 space-y-2">
              <PackageCheck size={32} className="mx-auto text-stone-300" />
              <p className="font-bold text-stone-700 text-sm">Belum Ada Data Audit di Sesi Ini</p>
              <p className="text-stone-400 max-w-md mx-auto leading-relaxed">
                Silakan tempelkan (*tap*) kartu RFID barang di gudang untuk mulai membandingkan stok fisik dengan stok terdaftar di sistem.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-20 bg-stone-50 shadow-xs">
                <tr className="bg-stone-50 border-b border-stone-100 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="p-3.5">Material Name & Base SKU</th>
                  <th className="p-3.5">Supplier</th>
                  <th className="p-3.5 text-center">Qty System</th>
                  <th className="p-3.5 text-center">Qty Physical (Audit)</th>
                  <th className="p-3.5 text-center">Selisih (Variance)</th>
                  <th className="p-3.5 text-center">Keterangan / Status Audit</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs text-stone-800">
                {groupedList.map((group) => {
                  const qtySystem = group.items.length;
                  const qtyPhysical = group.items.filter(i => auditScannedUids.has(String(i.nfc_uid || i.id).replace(/[^a-zA-Z0-9]/g, '').toUpperCase())).length;
                  const variance = qtyPhysical - qtySystem;
                  const isExpanded = !!expandedKeys[group.key];

                  let statusBadge = (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                      <CheckCircle2 size={12} /> SESUAI / MATCH
                    </span>
                  );

                  if (variance < 0) {
                    statusBadge = (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
                        <AlertCircle size={12} /> BARANG HILANG ({variance} Unit)
                      </span>
                    );
                  } else if (variance > 0) {
                    statusBadge = (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                        <AlertTriangle size={12} /> BARANG LEBIH (+{variance} Unit)
                      </span>
                    );
                  }

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
                        <td className="p-3.5 text-center font-bold text-stone-800">
                          {qtySystem} Pcs
                        </td>
                        <td className="p-3.5 text-center font-bold text-blue-600">
                          {qtyPhysical} Pcs
                        </td>
                        <td className="p-3.5 text-center font-mono font-bold">
                          {variance === 0 ? (
                            <span className="text-stone-400">0</span>
                          ) : variance < 0 ? (
                            <span className="text-rose-600">{variance}</span>
                          ) : (
                            <span className="text-amber-600">+{variance}</span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          {statusBadge}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleExpand(group.key); }}
                            className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-xl font-semibold text-xs transition inline-flex items-center gap-1 ml-auto cursor-pointer"
                          >
                            {isExpanded ? 'Hide Breakdown' : 'View UIDs'} <ChevronRight size={14} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </button>
                        </td>
                      </tr>

                      {/* Accordion Individual UID Audit Breakdown */}
                      {isExpanded && (
                        <tr className="bg-stone-50/80 animate-fade-in">
                          <td colSpan="7" className="p-4">
                            <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3 shadow-inner">
                              <h4 className="text-[11px] font-bold text-stone-700 uppercase tracking-wider flex items-center gap-2">
                                <Layers size={14} className="text-blue-600" /> Physically Scanned UIDs ({group.items.filter(i => auditScannedUids.has(String(i.nfc_uid || i.id).replace(/[^a-zA-Z0-9]/g, '').toUpperCase())).length} of {group.items.length})
                              </h4>
                              <div className="divide-y divide-stone-100 border border-stone-100 rounded-lg overflow-hidden">
                                {(() => {
                                  const scannedItems = group.items.filter(i => auditScannedUids.has(String(i.nfc_uid || i.id).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()));
                                  if (scannedItems.length === 0) {
                                    return (
                                      <div className="p-4 text-center text-xs text-stone-400">
                                        Belum ada UID yang di-scan pada material ini. Silakan tap kartu RFID untuk menambahkan hasil scan fisik.
                                      </div>
                                    );
                                  }
                                  return scannedItems.map((item) => {
                                    const cleanItemUid = String(item.nfc_uid || item.id).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                                    const isHighlighted = cleanItemUid === highlightedUid;

                                    return (
                                      <div
                                        key={item.id}
                                        className={`p-3 transition rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                                          isHighlighted
                                            ? 'bg-amber-100 border-2 border-amber-500 animate-pulse'
                                            : 'bg-emerald-50/60'
                                        }`}
                                      >
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <code className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">UID: {item.nfc_uid}</code>
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white flex items-center gap-1">
                                              <Check size={11} /> VERIFIED PRESENT
                                            </span>
                                          </div>
                                          <p className="text-[11px] text-stone-600 font-mono">
                                            SJ: <span className="font-semibold text-stone-800">{item.no_sj || '-'}</span> | SPK: <span className="font-semibold text-stone-800">{item.no_spk || '-'}</span>
                                          </p>
                                          <p className="text-[10px] text-stone-400 flex items-center gap-1">
                                            <Clock size={11} /> Registered Inbound: {item.scan_in_at?.toDate ? item.scan_in_at.toDate().toLocaleString() : 'Active'}
                                          </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <span className="text-stone-700 font-semibold text-[11px] bg-stone-100 px-3 py-1 rounded-full shrink-0 flex items-center gap-1">
                                            <User size={12} className="text-stone-500" /> {item.warehouse_user || 'Warehouse Admin'}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  });
                                })()}
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

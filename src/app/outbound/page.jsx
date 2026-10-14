'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/services/firebase/config';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { subscribeToInventory } from '@/services/firebase/inventoryService';
import { CapacitorNfc } from '@capgo/capacitor-nfc';
import {
  ArrowUpRight,
  Search,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ChevronRight,
  Trash2,
  Clock,
  User,
  Package
} from 'lucide-react';

export default function OutboundPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');
  const [scanAlertMessage, setScanAlertMessage] = useState('');
  const [expandedKeys, setExpandedKeys] = useState({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.triggerOutboundAlert = (uid) => {
        setScanAlertMessage(`Item with SKU / UID "${uid}" not found in warehouse!`);
        setTimeout(() => setScanAlertMessage(''), 6000);
      };
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToInventory((fetchedItems) => {
      // Filter items that have been checked out (Stock 0 or lifecycle completed / has SPK)
      const outboundItems = fetchedItems.filter(item => Number(item.stok ?? 1) === 0 || item.no_spk || item.lifecycle === 'COMPLETED');
      setItems(outboundItems);
      setLoading(false);
    });

    // Set system mode to INVENTORY
    fetch('/api/system-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'INVENTORY' })
    }).catch(err => console.log('Failed to set mode:', err));

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const handleDeleteItem = async (id, nama, uid) => {
    if (confirm(`Delete item "${nama}" (UID: ${uid})? Data will be deleted and NTAG card erased for reuse.`)) {
      try {
        await deleteDoc(doc(db, 'barang', String(id)));
        try {
          await CapacitorNfc.erase();
        } catch (e) {}
        setMessage(`🗑️ Successfully deleted "${nama}". Tag ready for reuse.`);
        setTimeout(() => setMessage(''), 4000);
      } catch (err) {
        alert('Failed to delete item: ' + err.message);
      }
    }
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

  const filteredItems = items.filter(item =>
    item.nama_barang?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.nfc_uid?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.no_spk?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.no_sj?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group items by Material Name
  const groupedMap = {};
  filteredItems.forEach(item => {
    const rawName = (item.nama_barang || 'Unnamed Item').trim();
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
    <div className="w-full space-y-6 pb-24">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-amber-600 font-semibold text-xs uppercase tracking-wider mb-1">
            <ArrowUpRight size={16} /> Outbound & Scan Out Hub
          </div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Outbound (Scan Out)</h1>
          <p className="text-stone-500 text-sm mt-0.5">
            Monitor and manage all checked-out warehouse items grouped by material with timestamps.
          </p>
        </div>
      </div>

      {scanAlertMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fade-in shadow-2xs">
          <AlertTriangle className="text-rose-600 shrink-0" size={18} />
          <span>{scanAlertMessage}</span>
        </div>
      )}

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Grouped Outbound Reconciliation Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-stone-900">Grouped Outbound Materials ({groupedList.length})</h3>
            <p className="text-xs text-stone-500 mt-0.5">Checked-out material groups and completed Scan OUT cycles</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search material, SKU, UID, or SPK..."
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-4 py-2 text-xs outline-none focus:border-amber-500 transition"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-stone-50 text-[11px] font-bold text-stone-500 uppercase tracking-wider border-b border-stone-200">
              <tr>
                <th className="py-3 px-6">Material Name & Base SKU</th>
                <th className="py-3 px-6">Supplier</th>
                <th className="py-3 px-6 text-center">Total Qty OUT</th>
                <th className="py-3 px-6">Latest Outbound Timestamp</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-stone-400">Loading outbound items...</td>
                </tr>
              ) : groupedList.length > 0 ? (
                groupedList.map((group) => {
                  const isExpanded = !!expandedKeys[group.key];
                  const latestOutItem = group.items.reduce((latest, current) => {
                    const currentTs = current.scan_out_at?.toDate ? current.scan_out_at.toDate().getTime() : 0;
                    const latestTs = latest?.scan_out_at?.toDate ? latest.scan_out_at.toDate().getTime() : 0;
                    return currentTs > latestTs ? current : latest;
                  }, group.items[0]);

                  return (
                    <React.Fragment key={group.key}>
                      <tr
                        onClick={() => toggleExpand(group.key)}
                        className="hover:bg-amber-50/40 transition cursor-pointer select-none"
                      >
                        <td className="py-4 px-6">
                          <p className="font-bold text-stone-900 flex items-center gap-2">
                            <span>{group.nama_barang}</span>
                            <ChevronRight size={14} className={`text-stone-400 transition-transform ${isExpanded ? 'rotate-90 text-amber-600' : ''}`} />
                          </p>
                          <p className="font-mono text-[11px] text-amber-600">{group.sku}</p>
                        </td>
                        <td className="py-4 px-6 text-stone-600 font-medium">{group.supplier}</td>
                        <td className="py-4 px-6 text-center font-bold text-amber-600">
                          {group.items.length} Pcs OUT
                        </td>
                        <td className="py-4 px-6 font-mono text-[11px] text-stone-700">
                          <span className="flex items-center gap-1.5">
                            <Clock size={12} className="text-amber-600" />
                            {formatTimestamp(latestOutItem?.scan_out_at)}
                          </span>
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                            <AlertTriangle size={12} /> Checked Out (Out)
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleExpand(group.key); }}
                            className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-xl font-semibold text-xs transition inline-flex items-center gap-1 ml-auto cursor-pointer"
                          >
                            {isExpanded ? 'Hide UIDs' : 'View UIDs'} <ChevronRight size={14} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </button>
                        </td>
                      </tr>

                      {/* Accordion Dropdown Breakdown */}
                      {isExpanded && (
                        <tr className="bg-stone-50/80 animate-fade-in">
                          <td colSpan="6" className="p-4">
                            <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3 shadow-inner">
                              <h4 className="text-[11px] font-bold text-stone-700 uppercase tracking-wider flex items-center gap-2">
                                <Layers size={14} className="text-amber-600" /> Individual Outbound UIDs Breakdown ({group.items.length})
                              </h4>
                              <div className="divide-y divide-stone-100 border border-stone-100 rounded-lg overflow-hidden">
                                {group.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="p-3 transition rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-stone-50/50 hover:bg-stone-50"
                                  >
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <code className="font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                                          UID: {item.nfc_uid}
                                        </code>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                          CHECKED OUT
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-stone-600 font-mono">
                                        SJ: <span className="font-semibold text-stone-800">{item.no_sj || '-'}</span> | SPK: <span className="font-semibold text-stone-800">{item.no_spk || '-'}</span>
                                      </p>
                                      <p className="text-[10px] text-stone-500 flex items-center gap-2 flex-wrap">
                                        <span className="flex items-center gap-1 font-semibold text-amber-700">
                                          <Clock size={11} /> Scan OUT Timestamp: {formatTimestamp(item.scan_out_at)}
                                        </span>
                                        <span className="text-stone-300">|</span>
                                        <span className="flex items-center gap-1 text-stone-400">
                                          Registered Inbound: {formatTimestamp(item.scan_in_at)}
                                        </span>
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <div className="flex items-center gap-1 text-stone-700 font-semibold text-[11px] bg-stone-100 px-3 py-1 rounded-full shrink-0">
                                        <User size={12} className="text-stone-500" /> {item.warehouse_user || 'Warehouse Admin'}
                                      </div>
                                      <button
                                        onClick={() => handleDeleteItem(item.id, item.nama_barang, item.nfc_uid)}
                                        className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center transition cursor-pointer border border-rose-100 shadow-2xs shrink-0"
                                        title="Delete item and erase tag"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-stone-400">
                    No outbound items yet. Perform Scan OUT on an active item to see it here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/services/firebase/config';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { subscribeToInventory } from '@/services/firebase/inventoryService';
import { CapacitorNfc } from '@capgo/capacitor-nfc';
import { useTranslation } from '@/services/languageService';
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
  Calendar,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function OutboundPage() {
  const { lang, t } = useTranslation();
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
      return date.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
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

  // Group items STRICTLY BY OUTBOUND DATE (Tanggal Outbound)
  const groupedMap = {};
  filteredItems.forEach(item => {
    const dateObj = item.scan_out_at?.toDate
      ? item.scan_out_at.toDate()
      : (item.scan_out_at ? new Date(item.scan_out_at) : new Date(item.updated_at?.toDate ? item.updated_at.toDate() : Date.now()));

    // Chronological YYYY-MM-DD sort key
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const sortKey = `${year}-${month}-${day}`;

    const displayDate = dateObj.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    if (!groupedMap[sortKey]) {
      groupedMap[sortKey] = {
        sortKey,
        displayDate,
        items: []
      };
    }
    groupedMap[sortKey].items.push(item);
  });

  // Sort chronologically (Newest Outbound Dates at Top)
  const groupedList = Object.values(groupedMap).sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  const toggleExpand = (key) => {
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const exportOutboundToExcel = () => {
    if (items.length === 0) {
      alert('No outbound items to export.');
      return;
    }

    const exportData = items.map((item, index) => ({
      No: index + 1,
      SKU: item.sku || '-',
      UID: item.nfc_uid || '-',
      Supplier: item.kategori || '-',
      'SJ No.': item.no_sj || '-',
      'Material Name': item.nama_barang || '-',
      'SPK No.': item.no_spk || '-',
      'Outbound Time': formatTimestamp(item.scan_out_at),
      Status: lang === 'id' ? 'TERPAKAI' : 'USED',
      'Outbound Operator': item.warehouse_user_out || item.warehouse_user || 'Warehouse Admin'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Outbound Report');
    XLSX.writeFile(workbook, `Outbound_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="w-full space-y-6 pb-24">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-600 font-semibold text-xs uppercase tracking-wider mb-1">
            <ArrowUpRight size={16} /> Outbound & Scan Out Hub
          </div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">{t('outboundHubTitle')}</h1>
          <p className="text-stone-500 text-sm mt-0.5">
            {t('outboundHubDesc')}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={exportOutboundToExcel}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-sm"
          >
            <FileSpreadsheet size={16} /> {t('exportExcel')}
          </button>
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

      {/* Date-Grouped Outbound Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              {lang === 'id' ? 'Pengelompokan Outbound Per Tanggal' : 'Outbound Grouped By Date'} ({groupedList.length} {lang === 'id' ? 'Tanggal' : 'Dates'})
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {lang === 'id' ? 'Daftar transaksi barang keluar dikelompokkan secara kronologis per tanggal' : 'Chronological outbound items grouped strictly by checkout date'}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-4 py-2 text-xs outline-none focus:border-amber-500 transition"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-stone-50 text-[11px] font-bold text-stone-500 uppercase tracking-wider border-b border-stone-200">
              <tr>
                <th className="py-3.5 px-6">{lang === 'id' ? 'Tanggal Outbound' : 'Outbound Date'}</th>
                <th className="py-3.5 px-6 text-center">{t('status')}</th>
                <th className="py-3.5 px-6 text-right">{lang === 'id' ? 'Total Barang Keluar' : 'Total Outbound Items'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="3" className="text-center py-12 text-stone-400">Loading outbound items...</td>
                </tr>
              ) : groupedList.length > 0 ? (
                groupedList.map((group) => {
                  const isExpanded = !!expandedKeys[group.sortKey];

                  return (
                    <React.Fragment key={group.sortKey}>
                      <tr
                        onClick={() => toggleExpand(group.sortKey)}
                        className="hover:bg-amber-50/40 transition cursor-pointer select-none"
                      >
                        <td className="py-4 px-6">
                          <p className="font-bold text-stone-900 flex items-center gap-2 text-sm">
                            <Calendar size={16} className="text-amber-600 shrink-0" />
                            <span>{group.displayDate}</span>
                            <ChevronRight size={14} className={`text-stone-400 transition-transform ${isExpanded ? 'rotate-90 text-amber-600' : ''}`} />
                          </p>
                        </td>
                        <td className="py-4 px-6 text-center whitespace-nowrap">
                          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">
                            {lang === 'id' ? 'TERPAKAI' : 'USED'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right font-bold text-amber-600 text-sm font-mono">
                          {group.items.length} Pcs
                        </td>
                      </tr>

                      {/* Accordion Dropdown Breakdown (Individual Outbound Items on This Date) */}
                      {isExpanded && (
                        <tr className="bg-stone-50/80 animate-fade-in">
                          <td colSpan="3" className="p-4">
                            <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3 shadow-inner">
                              <h4 className="text-[11px] font-bold text-stone-700 uppercase tracking-wider flex items-center gap-2">
                                <Layers size={14} className="text-amber-600" /> Items Checked Out On {group.displayDate} ({group.items.length} Total)
                              </h4>
                              <div className="divide-y divide-stone-100 border border-stone-100 rounded-lg overflow-hidden">
                                {group.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="p-3.5 transition rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-stone-50/50 hover:bg-stone-50 border border-stone-100"
                                  >
                                    <div className="space-y-1.5 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-stone-900 text-sm">{item.nama_barang || 'Unnamed Item'}</span>
                                        <code className="font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                                          SKU: {item.sku || '-'} | UID: {item.nfc_uid}
                                        </code>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                          {lang === 'id' ? 'TERPAKAI' : 'USED'}
                                        </span>
                                      </div>

                                      <p className="text-[11px] text-stone-600 font-mono">
                                        SJ: <span className="font-semibold text-stone-800">{item.no_sj || '-'}</span> | SPK: <span className="font-semibold text-stone-800">{item.no_spk || '-'}</span> | Supplier: <span className="font-semibold text-stone-800">{item.kategori || 'General'}</span>
                                      </p>

                                      {/* Timestamps: LEFT = Inbound Date | RIGHT = Outbound Date */}
                                      <div className="flex items-center justify-between gap-4 pt-1 text-[11px] font-mono text-stone-600 bg-white p-2 rounded-lg border border-stone-100 max-w-lg">
                                        <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                                          <Clock size={12} className="text-emerald-600 shrink-0" />
                                          <span>Inbound: {formatTimestamp(item.scan_in_at)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-amber-700 font-bold">
                                          <Clock size={12} className="text-amber-600 shrink-0" />
                                          <span>Outbound: {formatTimestamp(item.scan_out_at)}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-emerald-800 font-semibold text-[11px] bg-emerald-50 px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1 border border-emerald-200">
                                        <User size={12} className="text-emerald-600" /> In: {item.warehouse_user_in || item.warehouse_user || 'Warehouse Admin'}
                                      </span>
                                      <span className="text-amber-800 font-semibold text-[11px] bg-amber-50 px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1 border border-amber-200">
                                        <User size={12} className="text-amber-600" /> Out: {item.warehouse_user_out || item.warehouse_user || 'Warehouse Admin'}
                                      </span>
                                      <button
                                        onClick={() => handleDeleteItem(item.id, item.nama_barang, item.nfc_uid)}
                                        className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center transition cursor-pointer border border-rose-100 shadow-2xs shrink-0"
                                        title={t('deleteTitle')}
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
                  <td colSpan="3" className="text-center py-12 text-stone-400">
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

'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/services/firebase/config';
import { collection, query, orderBy, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { subscribeToInventory } from '@/services/firebase/inventoryService';
import { CapacitorNfc } from '@capgo/capacitor-nfc';
import { useTranslation } from '@/services/languageService';
import {
  ArrowDownLeft,
  Search,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Trash2,
  Clock,
  User,
  Calendar,
  Truck,
  Package,
  Layers
} from 'lucide-react';

export default function InboundPage() {
  const { lang, t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');
  const [highlightedUid, setHighlightedUid] = useState(null);

  // 3-Level Expanded Accordion State: Dates -> SJs -> Materials
  const [expandedDates, setExpandedDates] = useState({});
  const [expandedSjs, setExpandedSjs] = useState({});
  const [expandedMaterials, setExpandedMaterials] = useState({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.triggerInboundHighlight = (uid) => {
        const clean = String(uid).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        setHighlightedUid(clean);

        setTimeout(() => {
          const el = document.getElementById(`inbound-row-${clean}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 200);

        setTimeout(() => setHighlightedUid(null), 5000);
      };
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToInventory((fetchedItems) => {
      // Keep ALL registered inbound items permanently in Inbound list
      setItems(fetchedItems);
      setLoading(false);
    });

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
    item.no_sj?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Build 4-level nested grouping: Date -> SJ -> Material Name -> UIDs
  const dateMap = {};

  filteredItems.forEach(item => {
    const dateObj = item.scan_in_at?.toDate
      ? item.scan_in_at.toDate()
      : (item.scan_in_at ? new Date(item.scan_in_at) : new Date(item.created_at?.toDate ? item.created_at.toDate() : Date.now()));

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const dateSortKey = `${year}-${month}-${day}`;

    const displayDate = dateObj.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    if (!dateMap[dateSortKey]) {
      dateMap[dateSortKey] = {
        dateSortKey,
        displayDate,
        items: [],
        sjMap: {}
      };
    }

    const dateGroup = dateMap[dateSortKey];
    dateGroup.items.push(item);

    // Level 2: Group by Delivery Order (No. SJ)
    const sjRaw = (item.no_sj || 'No SJ Number').trim();
    const sjKey = sjRaw.toLowerCase();

    if (!dateGroup.sjMap[sjKey]) {
      const resolvedSupplier = (item.kategori && item.kategori !== '-' && item.kategori !== 'General Supplier')
        ? item.kategori
        : (item.supplier && item.supplier !== '-')
        ? item.supplier
        : 'Aneka Warna';

      dateGroup.sjMap[sjKey] = {
        sjKey,
        no_sj: sjRaw,
        supplier: resolvedSupplier,
        operator: item.warehouse_user_in || item.warehouse_user || 'Warehouse Admin',
        items: [],
        materialMap: {}
      };
    }

    const sjGroup = dateGroup.sjMap[sjKey];
    sjGroup.items.push(item);

    // Level 3: Group by Material Name
    const matRaw = (item.nama_barang || 'Unnamed Item').trim();
    const matKey = matRaw.toLowerCase();

    if (!sjGroup.materialMap[matKey]) {
      let baseSku = item.sku || '-';
      if (item.sku && item.sku.includes('-')) {
        const parts = item.sku.split('-');
        if (parts.length > 1 && parts[parts.length - 1].length >= 4) {
          parts.pop();
          baseSku = parts.join('-');
        }
      }

      sjGroup.materialMap[matKey] = {
        matKey,
        nama_barang: matRaw,
        sku: baseSku,
        supplier: item.kategori || 'General',
        items: []
      };
    }

    sjGroup.materialMap[matKey].items.push(item);
  });

  // Sort chronologically (Newest Date Top)
  const dateList = Object.values(dateMap).sort((a, b) => b.dateSortKey.localeCompare(a.dateSortKey));

  const toggleDateExpand = (key) => {
    setExpandedDates(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSjExpand = (key) => {
    setExpandedSjs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleMaterialExpand = (key) => {
    setExpandedMaterials(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="w-full space-y-6 pb-24">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 font-semibold text-xs uppercase tracking-wider mb-1">
            <ArrowDownLeft size={16} /> Inbound & Active Inventory Hub
          </div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">{t('inboundHubTitle')}</h1>
          <p className="text-stone-500 text-sm mt-0.5">
            {t('inboundHubDesc')}
          </p>
        </div>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* 4-Level Nested Accordion Inbound Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              {lang === 'id' ? 'Pengelompokan Inbound Per Tanggal' : 'Inbound Grouped By Date'} ({dateList.length} {lang === 'id' ? 'Tanggal' : 'Dates'})
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {lang === 'id' ? 'Struktur hirarki berlapis: Tanggal -> No. SJ -> Nama Material -> UID Barang' : 'Nested hierarchy: Date -> Delivery Order (SJ) -> Material Name -> Individual UIDs'}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-4 py-2 text-xs outline-none focus:border-emerald-500 transition"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-stone-50 text-[11px] font-bold text-stone-500 uppercase tracking-wider border-b border-stone-200">
              <tr>
                <th className="py-3.5 px-6">{lang === 'id' ? 'Tanggal Inbound' : 'Inbound Date'}</th>
                <th className="py-3.5 px-6 text-right">{lang === 'id' ? 'Total Barang Diterima' : 'Total Received Items'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="2" className="text-center py-12 text-stone-400">Loading inbound items...</td>
                </tr>
              ) : dateList.length > 0 ? (
                dateList.map((dateGroup) => {
                  const isDateExpanded = !!expandedDates[dateGroup.dateSortKey];
                  const sjList = Object.values(dateGroup.sjMap);

                  return (
                    <React.Fragment key={dateGroup.dateSortKey}>
                      {/* LEVEL 1: Date Row */}
                      <tr
                        onClick={() => toggleDateExpand(dateGroup.dateSortKey)}
                        className="hover:bg-emerald-50/40 transition cursor-pointer select-none"
                      >
                        <td className="py-4 px-6">
                          <p className="font-bold text-stone-900 flex items-center gap-2 text-sm">
                            <Calendar size={16} className="text-emerald-600 shrink-0" />
                            <span>{dateGroup.displayDate}</span>
                            <ChevronRight size={14} className={`text-stone-400 transition-transform ${isDateExpanded ? 'rotate-90 text-emerald-600' : ''}`} />
                          </p>
                        </td>
                        <td className="py-4 px-6 text-right font-bold text-emerald-600 text-sm">
                          {dateGroup.items.length} Pcs RECEIVED
                        </td>
                      </tr>

                      {/* LEVEL 2: SJ Accordion Dropdown */}
                      {isDateExpanded && (
                        <tr className="bg-stone-50/70 animate-fade-in">
                          <td colSpan="2" className="p-4">
                            <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3 shadow-inner">
                              <h4 className="text-[11px] font-bold text-stone-700 uppercase tracking-wider flex items-center gap-2">
                                <Truck size={14} className="text-emerald-600" />
                                {lang === 'id' ? 'Surat Jalan (SJ) Diterima Pada' : 'Delivery Orders (SJ) Received On'} {dateGroup.displayDate} ({sjList.length})
                              </h4>

                              <div className="space-y-2">
                                {sjList.map((sjGroup) => {
                                  const sjKeyFull = `${dateGroup.dateSortKey}_${sjGroup.sjKey}`;
                                  const isSjExpanded = !!expandedSjs[sjKeyFull];
                                  const materialList = Object.values(sjGroup.materialMap);

                                  return (
                                    <div key={sjKeyFull} className="border border-stone-200 rounded-xl overflow-hidden bg-stone-50/30">
                                      {/* LEVEL 2 ROW: SJ Header */}
                                      <div
                                        onClick={() => toggleSjExpand(sjKeyFull)}
                                        className="p-3 bg-stone-100/70 hover:bg-stone-100 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs select-none"
                                      >
                                        <div className="flex items-center gap-2.5">
                                          <Truck size={15} className="text-emerald-600 shrink-0" />
                                          <div>
                                            <p className="font-bold text-stone-900 font-mono flex items-center gap-2 flex-wrap">
                                              <span>Delivery Order (SJ): <strong>{sjGroup.no_sj}</strong></span>
                                              <span className="text-stone-300">|</span>
                                              <span className="bg-emerald-50 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 text-[11px] font-sans">
                                                🏢 {sjGroup.supplier}
                                              </span>
                                              <ChevronRight size={14} className={`text-stone-400 transition-transform ${isSjExpanded ? 'rotate-90 text-emerald-600' : ''}`} />
                                            </p>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                          <span className="bg-white text-stone-800 font-semibold px-3 py-1 rounded-full text-[11px] border border-stone-200 flex items-center gap-1">
                                            <User size={12} className="text-stone-500" /> {lang === 'id' ? 'Operator' : 'Inbound Operator'}: <strong>{sjGroup.operator}</strong>
                                          </span>
                                          <span className="font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full text-[11px]">
                                            {sjGroup.items.length} Pcs
                                          </span>
                                        </div>
                                      </div>

                                      {/* LEVEL 3: Material Name Accordion Dropdown */}
                                      {isSjExpanded && (
                                        <div className="p-3 bg-white space-y-2 border-t border-stone-200">
                                          {materialList.map((matGroup) => {
                                            const matKeyFull = `${sjKeyFull}_${matGroup.matKey}`;
                                            const isMatExpanded = !!expandedMaterials[matKeyFull];

                                            return (
                                              <div key={matKeyFull} className="border border-stone-100 rounded-lg overflow-hidden bg-stone-50/20">
                                                {/* LEVEL 3 ROW: Material Header */}
                                                <div
                                                  onClick={() => toggleMaterialExpand(matKeyFull)}
                                                  className="p-2.5 bg-stone-50 hover:bg-stone-100/80 transition cursor-pointer flex items-center justify-between text-xs select-none"
                                                >
                                                  <div className="flex items-center gap-2">
                                                    <Package size={14} className="text-blue-600 shrink-0" />
                                                    <div>
                                                      <span className="font-bold text-stone-900">{matGroup.nama_barang}</span>
                                                      <span className="font-mono text-[11px] text-blue-600 ml-2">({matGroup.sku})</span>
                                                    </div>
                                                    <ChevronRight size={13} className={`text-stone-400 transition-transform ${isMatExpanded ? 'rotate-90 text-blue-600' : ''}`} />
                                                  </div>

                                                  <span className="font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full text-[10px] border border-blue-100">
                                                    {matGroup.items.length} Items
                                                  </span>
                                                </div>

                                                {/* LEVEL 4: Individual UID Cards */}
                                                {isMatExpanded && (
                                                  <div className="p-2.5 bg-white divide-y divide-stone-100 border-t border-stone-100 space-y-2">
                                                    {matGroup.items.map((item) => {
                                                      const cleanItemUid = String(item.nfc_uid || item.id).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                                                      const isHighlighted = cleanItemUid === highlightedUid;

                                                      return (
                                                        <div
                                                          key={item.id}
                                                          id={`inbound-row-${cleanItemUid}`}
                                                          className={`p-3 transition rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                                                            isHighlighted
                                                              ? 'bg-amber-100 border-2 border-amber-500 animate-pulse shadow-md ring-2 ring-amber-300'
                                                              : 'bg-stone-50/50 hover:bg-stone-50 border border-stone-100'
                                                          }`}
                                                        >
                                                          <div className="space-y-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                              <code className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                                                SKU: {item.sku || '-'} | UID: {item.nfc_uid}
                                                              </code>
                                                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white flex items-center gap-1">
                                                                <CheckCircle2 size={11} /> {lang === 'id' ? 'DITERIMA' : 'RECEIVED'}
                                                              </span>
                                                            </div>
                                                            <p className="text-[11px] text-stone-600 font-mono">
                                                              Supplier: <span className="font-semibold text-stone-800">{item.kategori || 'General'}</span> | Delivery Order (SJ): <span className="font-semibold text-stone-800">{item.no_sj || '-'}</span>
                                                            </p>
                                                            <p className="text-[10px] text-stone-500 flex items-center gap-1">
                                                              <Clock size={11} className="text-emerald-600" />
                                                              <span>Inbound Time: {formatTimestamp(item.scan_in_at)}</span>
                                                            </p>
                                                          </div>

                                                          <div className="flex items-center gap-2">
                                                            <button
                                                              onClick={() => handleDeleteItem(item.id, item.nama_barang, item.nfc_uid)}
                                                              className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center transition cursor-pointer border border-rose-100 shadow-2xs shrink-0"
                                                              title={t('deleteTitle')}
                                                            >
                                                              <Trash2 size={13} />
                                                            </button>
                                                          </div>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
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
                })
              ) : (
                <tr>
                  <td colSpan="2" className="text-center py-12 text-stone-400">
                    No inbound items found.
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

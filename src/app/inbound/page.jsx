'use client';

import { useState, useEffect } from 'react';
import { db } from '@/services/firebase/config';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { subscribeToInventory } from '@/services/firebase/inventoryService';
import { CapacitorNfc } from '@capgo/capacitor-nfc';
import { useTranslation } from '@/services/languageService';
import { ArrowDownLeft, Search, CheckCircle2, AlertTriangle, Box, Trash2 } from 'lucide-react';

export default function InboundPage() {
  const { lang, t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');
  const [highlightedUid, setHighlightedUid] = useState(null);

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
      // Strict filter: ONLY active inbound items currently in the warehouse
      const activeInboundItems = fetchedItems.filter(item => !item.is_completed && item.lifecycle !== 'COMPLETED' && Number(item.stok ?? 1) > 0);
      setItems(activeInboundItems);
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
      } catch (err) {
        alert('Failed to delete item: ' + err.message);
      }
    }
  };

  const filteredItems = items.filter(item =>
    item.nama_barang?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.nfc_uid?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.no_sj?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full space-y-6 pb-24">
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

      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-stone-900">{t('inboundListTitle')} ({filteredItems.length})</h3>
            <p className="text-xs text-stone-500 mt-0.5">{t('inboundListDesc')}</p>
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
                <th className="py-3 px-6">{t('materialName')}</th>
                <th className="py-3 px-6">{t('skuAndUid')}</th>
                <th className="py-3 px-6">{t('supplier')}</th>
                <th className="py-3 px-6">{t('sjAndSpk')}</th>
                <th className="py-3 px-6">{t('operator')}</th>
                <th className="py-3 px-6">{t('status')}</th>
                <th className="py-3 px-6 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-stone-400">Loading inbound items...</td>
                </tr>
              ) : filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const cleanItemUid = String(item.nfc_uid || item.id).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                  const isHighlighted = cleanItemUid === highlightedUid;

                  return (
                    <tr
                      key={item.id}
                      id={`inbound-row-${cleanItemUid}`}
                      className={`transition ${
                        isHighlighted
                          ? 'bg-amber-100 border-2 border-amber-500 animate-pulse shadow-md ring-2 ring-amber-300'
                          : 'hover:bg-stone-50/50'
                      }`}
                    >
                      <td className="py-4 px-6 font-bold text-stone-900">{item.nama_barang || 'Unnamed Item'}</td>
                      <td className="py-4 px-6">
                        <p className="font-mono font-bold text-emerald-600">{item.sku || '-'}</p>
                        <p className="text-[10px] text-stone-400 font-mono">UID: {item.nfc_uid}</p>
                      </td>
                      <td className="py-4 px-6 text-stone-600">{item.kategori || 'General'}</td>
                      <td className="py-4 px-6 font-mono text-stone-600 text-[11px] whitespace-nowrap">
                        SJ: <span className="font-semibold text-stone-800">{item.no_sj || '-'}</span><br/>
                        SPK: <span className="font-semibold text-stone-800">{item.no_spk || '-'}</span>
                      </td>
                      <td className="py-4 px-6 text-stone-600 font-medium">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-stone-100 text-stone-700 border border-stone-200">
                          {item.warehouse_user || 'Warehouse Admin'}
                        </span>
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 inline-flex items-center gap-1">
                          {t('activeInWarehouse')}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteItem(item.id, item.nama_barang, item.nfc_uid)}
                          className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center transition cursor-pointer border border-rose-100 shadow-2xs ml-auto"
                          title={t('deleteTitle')}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-stone-400">
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

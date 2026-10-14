'use client';

import { useState, useEffect } from 'react';
import { db } from '@/services/firebase/config';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { subscribeToInventory } from '@/services/firebase/inventoryService';
import { CapacitorNfc } from '@capgo/capacitor-nfc';
import { ArrowDownLeft, Search, CheckCircle2, AlertTriangle, Box, Trash2 } from 'lucide-react';

export default function InboundPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeToInventory((fetchedItems) => {
      setItems(fetchedItems);
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
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Inbound (Scan In)</h1>
          <p className="text-stone-500 text-sm mt-0.5">
            All scanned incoming items and registered warehouse inventory.
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
            <h3 className="text-base font-bold text-stone-900">Inbound Items List ({filteredItems.length})</h3>
            <p className="text-xs text-stone-500 mt-0.5">Scanned and registered incoming items in the warehouse</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search material, SKU, UID, or SJ..."
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-4 py-2 text-xs outline-none focus:border-emerald-500 transition"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-stone-50 text-[11px] font-bold text-stone-500 uppercase tracking-wider border-b border-stone-200">
              <tr>
                <th className="py-3 px-6">Material Name</th>
                <th className="py-3 px-6">SKU & UID</th>
                <th className="py-3 px-6">Supplier</th>
                <th className="py-3 px-6">SJ & SPK No.</th>
                <th className="py-3 px-6">Operator</th>
                <th className="py-3 px-6">Tag Status</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-stone-400">Loading inbound items...</td>
                </tr>
              ) : filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const stok = Number(item.stok ?? 0);
                  const isDepleted = stok === 0 || item.lifecycle === 'COMPLETED';
                  return (
                    <tr key={item.id} className="hover:bg-stone-50/50 transition">
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
                        {isDepleted ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                            <AlertTriangle size={12} /> Completed (Out)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 inline-flex items-center gap-1">
                            Active (In)
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteItem(item.id, item.nama_barang, item.nfc_uid)}
                          className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center transition cursor-pointer border border-rose-100 shadow-2xs ml-auto"
                          title="Delete item and erase tag"
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
                    No items in inbound yet. Scan a new NFC tag to perform Scan IN.
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

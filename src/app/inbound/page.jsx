'use client';

import { useState, useEffect } from 'react';
import { db } from '@/services/firebase/config';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { ArrowDownLeft, Search, Truck, FileText, Box } from 'lucide-react';

export default function InboundPage() {
  const [inboundItems, setInboundItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchInbound = async () => {
      try {
        setLoading(true);
        const q = query(collection(db, 'riwayat_transaksi'), where('tipe', '==', 'IN'), orderBy('timestamp', 'desc'));
        const snap = await getDocs(q);
        setInboundItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error fetching inbound history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInbound();
  }, []);

  const filtered = inboundItems.filter(item =>
    item.nama_barang?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.nfc_uid?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.no_sj?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full space-y-6 pb-24">
      <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 font-semibold text-xs uppercase tracking-wider mb-1">
            <ArrowDownLeft size={16} /> Inbound Management
          </div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Inbound (Scan In)</h1>
          <p className="text-stone-500 text-sm mt-0.5">
            Monitor and manage all incoming warehouse shipments and Scan IN registrations.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-stone-900">Inbound History ({filtered.length})</h3>
            <p className="text-xs text-stone-500 mt-0.5">List of all registered incoming items with Delivery Order (SJ)</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search SKU, name, or SJ no..."
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
                <th className="py-3 px-6">Delivery Order (SJ)</th>
                <th className="py-3 px-6">Operator</th>
                <th className="py-3 px-6">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-12 text-stone-400">Loading inbound records...</td>
                </tr>
              ) : filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-stone-50/50 transition">
                    <td className="py-4 px-6 font-bold text-stone-900">{item.nama_barang || 'Unnamed Item'}</td>
                    <td className="py-4 px-6">
                      <p className="font-mono font-bold text-emerald-600">{item.sku || '-'}</p>
                      <p className="text-[10px] text-stone-400 font-mono">UID: {item.nfc_uid}</p>
                    </td>
                    <td className="py-4 px-6 font-mono font-semibold text-stone-800">{item.no_sj || '-'}</td>
                    <td className="py-4 px-6 text-stone-600">{item.warehouse_user || 'Warehouse Admin'}</td>
                    <td className="py-4 px-6 text-stone-500">{item.timestamp?.toDate ? item.timestamp.toDate().toLocaleString() : 'Just now'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center py-12 text-stone-400">No inbound transaction records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

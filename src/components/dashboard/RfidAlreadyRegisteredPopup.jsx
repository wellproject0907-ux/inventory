'use client';

import { useState, useEffect } from 'react';
import { db } from '@/services/firebase/config';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { AlertCircle, Clock, Truck, FileText, Check, X, Tag } from 'lucide-react';

export default function RfidAlreadyRegisteredPopup() {
  const [registeredItem, setRegisteredItem] = useState(null);
  const [historyList, setHistoryList] = useState([]);

  useEffect(() => {
    // Listen to items where needs_already_registered_popup is true
    const q = query(collection(db, 'barang'), where('needs_already_registered_popup', '==', true));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        setRegisteredItem({ id: docSnap.id, ...data });

        // Fetch transaction history for this UID
        try {
          const txQuery = query(collection(db, 'riwayat_transaksi'), where('nfc_uid', '==', data.nfc_uid));
          const txSnap = await getDocs(txQuery);
          setHistoryList(txSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
          console.error('Error fetching transaction history:', err);
        }
      } else {
        setRegisteredItem(null);
        setHistoryList([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleDismiss = async () => {
    if (!registeredItem) return;
    try {
      await fetch('/api/arduino/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: registeredItem.nfc_uid, action: 'DISMISS_ALREADY_REGISTERED' })
      }).catch(() => {});
      setRegisteredItem(null);
    } catch (e) {
      setRegisteredItem(null);
    }
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

  if (!registeredItem) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-100 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <AlertCircle size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">Tag Already Registered!</h3>
              <p className="text-xs text-stone-500">UID: <code className="bg-stone-100 px-1.5 py-0.5 rounded text-blue-600 font-mono">{registeredItem.nfc_uid}</code></p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Item Info */}
        <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-4 space-y-2 text-xs">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Item Details:</p>
          <div className="grid grid-cols-2 gap-2 text-stone-700">
            <div>
              <span className="text-stone-400 block text-[10px]">SKU:</span>
              <strong className="font-mono text-blue-600">{registeredItem.sku || '-'}</strong>
            </div>
            <div>
              <span className="text-stone-400 block text-[10px]">Material Name:</span>
              <strong className="text-stone-900">{registeredItem.nama_barang || '-'}</strong>
            </div>
            <div>
              <span className="text-stone-400 block text-[10px]">Delivery Order (SJ):</span>
              <span className="font-mono font-semibold">{registeredItem.no_sj || '-'}</span>
            </div>
            <div>
              <span className="text-stone-400 block text-[10px]">SPK Number:</span>
              <span className="font-mono font-semibold">{registeredItem.no_spk || '-'}</span>
            </div>
          </div>
        </div>

        {/* IN & OUT History */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-stone-800 uppercase tracking-wider">Transaction History (IN & OUT):</p>
          <div className="space-y-2">
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 text-xs flex justify-between items-center">
              <div>
                <span className="font-bold text-emerald-800">Scan IN (Received)</span>
                <p className="text-[10px] text-stone-500 flex items-center gap-1 mt-0.5">
                  <Clock size={11} /> {formatTimestamp(registeredItem.scan_in_at)}
                </p>
              </div>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded-full">IN (Qty: 1)</span>
            </div>

            <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 text-xs flex justify-between items-center">
              <div>
                <span className="font-bold text-amber-800">Scan OUT (Dispatched)</span>
                <p className="text-[10px] text-stone-500 flex items-center gap-1 mt-0.5">
                  <Clock size={11} /> {formatTimestamp(registeredItem.scan_out_at)}
                </p>
              </div>
              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-1 rounded-full">OUT (Completed)</span>
            </div>
          </div>
        </div>

        <div className="pt-3">
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full bg-stone-900 hover:bg-stone-800 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

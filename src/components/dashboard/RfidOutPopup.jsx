'use client';

import { useState, useEffect } from 'react';
import { db } from '@/services/firebase/config';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { ArrowDownLeft, Loader2, Check, FileText, Truck, Tag, X } from 'lucide-react';

export default function RfidOutPopup() {
  const [pendingOutItem, setPendingOutItem] = useState(null);
  const [noSpk, setNoSpk] = useState('');
  const [activeOperator, setActiveOperator] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Listen to active operator
    const unsubSettings = onSnapshot(doc(db, 'system', 'settings'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.active_operator_name) {
          setActiveOperator({ name: data.active_operator_name, role: data.active_operator_role });
        } else {
          setActiveOperator(null);
        }
      }
    });

    // Listen to items where needs_spk is true (Scan 2 - OUT)
    const q = query(collection(db, 'barang'), where('needs_spk', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        setPendingOutItem({ id: docSnap.id, ...data });
      } else {
        setPendingOutItem(null);
        setNoSpk('');
      }
    });

    return () => {
      unsubscribe();
      unsubSettings();
    };
  }, []);

  const handleSpkInputChange = (e) => {
    let val = e.target.value;

    if (!val.startsWith('SPK-')) {
      const clean = val.replace(/^SPK-?/i, '');
      val = 'SPK-' + clean;
    }

    const rest = val.slice(4);
    const match = rest.match(/^(\d{1,4})(.*)$/);
    if (match) {
      const digits = match[1];
      const tail = match[2];
      if (digits.length === 4 && !tail.startsWith('-')) {
        val = `SPK-${digits}-${tail}`;
      }
    }

    setNoSpk(val);
  };

  const handleCancel = async () => {
    if (!pendingOutItem) return;
    try {
      // Reset needs_spk if cancelled
      await fetch('/api/arduino/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: pendingOutItem.nfc_uid, action: 'CONFIRM_OUT', no_spk: 'CANCELLED' })
      }).catch(() => {});
      setPendingOutItem(null);
    } catch (e) {
      setPendingOutItem(null);
    }
  };

  const handleConfirmOut = async (e) => {
    e.preventDefault();
    if (!activeOperator) {
      alert('⚠️ Otorisasi Operator Diperlukan! Silakan scan Kartu ID Operator terlebih dahulu pada alat Arduino.');
      return;
    }
    if (!pendingOutItem || !noSpk) {
      alert('Nomor SPK wajib diisi!');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/arduino/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: pendingOutItem.nfc_uid,
          action: 'CONFIRM_OUT',
          no_spk: noSpk,
          warehouse_user: activeOperator.name
        })
      });

      if (res.ok) {
        setPendingOutItem(null);
        setNoSpk('');
      } else {
        alert('Gagal mengkonfirmasi Stock OUT');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  if (!pendingOutItem) return null;

  if (!activeOperator && pendingOutItem) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-100 space-y-4 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto text-xl font-bold animate-pulse shadow-sm">
            ⚠️
          </div>
          <h3 className="text-lg font-bold text-stone-900">Otorisasi Operator Diperlukan</h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Belum ada operator yang terotorisasi. Silakan tempelkan **Kartu ID Operator** terlebih dahulu pada alat **Arduino RC522** untuk membuka akses konfirmasi Stock OUT.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              Tutup / Batalkan Scan
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-100 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <ArrowDownLeft size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">Scan 2: Konfirmasi Stock OUT (Keluar)</h3>
              <p className="text-xs text-stone-500">UID: <code className="bg-stone-100 px-1.5 py-0.5 rounded text-blue-600 font-mono">{pendingOutItem.nfc_uid}</code></p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Operator Authorization Status Banner */}
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span>✅ Authorized Operator: <strong>{activeOperator.name}</strong> ({activeOperator.role || 'Staff Gudang'})</span>
        </div>

        {/* Data Preview from Scan In */}
        <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-4 space-y-2 text-xs">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Data Barang Saat Scan In:</p>
          <div className="grid grid-cols-2 gap-2 text-stone-700">
            <div>
              <span className="text-stone-400 block text-[10px]">SKU:</span>
              <strong className="font-mono text-blue-600">{pendingOutItem.sku || '-'}</strong>
            </div>
            <div>
              <span className="text-stone-400 block text-[10px]">Nama Bahan:</span>
              <strong className="font-stone-900 text-stone-900">{pendingOutItem.nama_barang || '-'}</strong>
            </div>
            <div>
              <span className="text-stone-400 block text-[10px]">Supplier:</span>
              <span>{pendingOutItem.kategori || '-'}</span>
            </div>
            <div>
              <span className="text-stone-400 block text-[10px]">No. Surat Jalan (SJ):</span>
              <span className="font-mono font-semibold">{pendingOutItem.no_sj || '-'}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleConfirmOut} className="space-y-3.5 pt-1">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1.5">
              <FileText size={14} className="text-amber-600" /> Work Order (SPK):
            </label>
            <input
              type="text"
              value={noSpk || 'SPK-'}
              onChange={handleSpkInputChange}
              placeholder="e.g. SPK-1234-PROJECT_A"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-500 font-mono text-stone-900 font-bold"
              required
              autoFocus
            />
          </div>

          <div className="pt-3 flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || !activeOperator}
              className="flex-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Konfirmasi Stock OUT
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

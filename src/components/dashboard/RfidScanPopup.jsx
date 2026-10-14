'use client';

import { useState, useEffect } from 'react';
import { db } from '@/services/firebase/config';
import { collection, query, where, onSnapshot, getDocs, orderBy, limit, doc } from 'firebase/firestore';
import { Tag, Loader2, Check, Search, Truck, X, History, Clock, Sparkles } from 'lucide-react';

export default function RfidScanPopup() {
  const [pendingItem, setPendingItem] = useState(null);
  const [bahanList, setBahanList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBahan, setSelectedBahan] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeOperator, setActiveOperator] = useState(null);

  // Form fields
  const [namaBarang, setNamaBarang] = useState('');
  const [supplier, setSupplier] = useState(''); // Terkunci sesuai item Master Data
  const [qty, setQty] = useState(1);
  const [noSj, setNoSj] = useState('');
  const [suggestedSj, setSuggestedSj] = useState('');
  const [sjHistory, setSjHistory] = useState([]);
  const [lastHistory, setLastHistory] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const bahanSnap = await getDocs(collection(db, 'bahan'));
        setBahanList(bahanSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const txSnap = await getDocs(collection(db, 'riwayat_transaksi'));
        const sjs = new Set();
        txSnap.docs.forEach(d => {
          const data = d.data();
          if (data.no_sj) sjs.add(data.no_sj);
        });
        setSjHistory(Array.from(sjs));
      } catch (err) {
        console.error('Error fetching master data:', err);
      }
    };
    fetchData();

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

    // Listen to items where needs_naming is true
    const q = query(collection(db, 'barang'), where('needs_naming', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        setPendingItem({ id: docSnap.id, ...data });
      } else {
        setPendingItem(null);
        setSelectedBahan(null);
        setSearchQuery('');
        setNamaBarang('');
        setSupplier('');
        setQty(1);
        setNoSj('');
        setSuggestedSj('');
        setLastHistory(null);
      }
    });

    return () => {
      unsubscribe();
      unsubSettings();
    };
  }, []);

  const filteredBahan = bahanList.filter(b => {
    const skuVal = b.sku || '';
    const nameVal = b.nama_bahan || '';
    const q = searchQuery.toLowerCase();
    return skuVal.toLowerCase().includes(q) || nameVal.toLowerCase().includes(q);
  });

  const generateNextSj = (currentSj) => {
    if (!currentSj) return '';
    const match = currentSj.match(/(\d+)(\D*)$/);
    if (!match) return currentSj + '-01';
    const numStr = match[1];
    const prefix = currentSj.substring(0, currentSj.length - match[0].length);
    const suffix = match[2];
    const nextNum = (parseInt(numStr, 10) + 1).toString().padStart(numStr.length, '0');
    return prefix + nextNum + suffix;
  };

  const handleSelectBahan = async (bahan) => {
    setSelectedBahan(bahan);
    const skuCode = bahan.sku || bahan.kode || bahan.id || '';
    setSearchQuery(skuCode);
    setNamaBarang(bahan.nama_bahan || '');
    setShowDropdown(false);

    // Kunci supplier sesuai dengan yang ada di item Master Data
    const itemSupplier = bahan.supplier && bahan.supplier !== '-' ? bahan.supplier : 'General Supplier';
    setSupplier(itemSupplier);

    try {
      const qTx = query(
        collection(db, 'riwayat_transaksi'),
        where('sku', '==', skuCode),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      const txSnap = await getDocs(qTx);
      if (!txSnap.empty) {
        const lastTx = txSnap.docs[0].data();
        setLastHistory(lastTx);
        if (lastTx.no_sj) {
          setNoSj(lastTx.no_sj);
          setSuggestedSj(generateNextSj(lastTx.no_sj));
          return;
        }
      }

      const barangSnap = await getDocs(collection(db, 'barang'));
      const found = barangSnap.docs.map(d => d.data()).find(b => b.sku === skuCode && b.no_sj);
      if (found) {
        setLastHistory(found);
        setNoSj(found.no_sj || '');
        setSuggestedSj(generateNextSj(found.no_sj || ''));
      } else {
        setLastHistory(null);
        setNoSj('');
        setSuggestedSj('');
      }
    } catch (err) {
      console.log('Error fetching last history for SKU:', err);
      setLastHistory(null);
      setNoSj('');
      setSuggestedSj('');
    }
  };

  const handleCancel = async () => {
    if (!pendingItem) return;
    try {
      await fetch(`/api/barang/${encodeURIComponent(pendingItem.nfc_uid)}`, {
        method: 'DELETE'
      }).catch(() => {});
      setPendingItem(null);
    } catch (err) {
      setPendingItem(null);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!activeOperator) {
      alert('⚠️ Operator Authorization Required! Please scan Operator ID Card on reader first.');
      return;
    }
    if (!pendingItem || !selectedBahan) {
      alert('Please select SKU from Master Data first!');
      return;
    }

    const skuCode = selectedBahan.sku || 'SKU';
    const uniqueSuffix = pendingItem.nfc_uid.slice(-6);
    const generatedSkuId = `${skuCode}-${uniqueSuffix}`;

    try {
      setLoading(true);
      const res = await fetch('/api/arduino/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: pendingItem.nfc_uid,
          sku: generatedSkuId,
          nama_barang: namaBarang,
          kategori: supplier,
          qty: Number(qty) || 1,
          no_sj: noSj || 'SJ-DEFAULT',
          warehouse_user: activeOperator.name
        })
      });

      if (res.ok) {
        setPendingItem(null);
        setSearchQuery('');
        setSelectedBahan(null);
        setNamaBarang('');
        setSupplier('');
        setQty(1);
        setNoSj('');
        setSuggestedSj('');
        setLastHistory(null);
      } else {
        alert('Failed to save item details');
      }
    } catch (err) {
      console.error(err);
      alert('Network error occurred');
    } finally {
      setLoading(false);
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

  if (!pendingItem) return null;

  // STRICT OPERATOR AUTHORIZATION BLOCKING MODAL
  if (!activeOperator) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-100 space-y-4 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto text-xl font-bold animate-pulse shadow-sm">
            ⚠️
          </div>
          <h3 className="text-lg font-bold text-stone-900">Operator Authorization Required</h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            No operator authorized. Please scan **Operator ID Card** on reader first to grant inbound registration access.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              Close / Cancel Scan
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
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Tag size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">Scan 1: Register Inbound Inventory (IN)</h3>
              <p className="text-xs text-stone-500">UID: <code className="bg-stone-100 px-1.5 py-0.5 rounded text-blue-600 font-mono">{pendingItem.nfc_uid}</code></p>
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
          <span>✅ Authorized Operator: <strong>{activeOperator.name}</strong> ({activeOperator.role || 'Warehouse Staff'})</span>
        </div>

        <form onSubmit={handleSave} className="space-y-3.5 pt-1">
          {/* Autosearch SKU */}
          <div className="relative">
            <label className="block text-xs font-semibold text-stone-700 mb-1">Cari berdasarkan SKU (Auto-Search):</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-stone-400">
                <Search size={14} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                  if (!e.target.value) {
                    setSelectedBahan(null);
                    setNamaBarang('');
                    setSupplier('');
                  }
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Ketik SKU untuk mencari..."
                className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-blue-500 font-mono text-stone-900"
                required
              />
            </div>

            {showDropdown && searchQuery && filteredBahan.length > 0 && (
              <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {filteredBahan.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => handleSelectBahan(b)}
                    className="px-4 py-2 hover:bg-stone-50 text-xs cursor-pointer border-b border-stone-50 last:border-none flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono font-bold text-blue-600">{b.sku}</span> - <span className="font-bold text-stone-900">{b.nama_bahan}</span>
                      <p className="text-[10px] text-stone-400">Supplier: {b.supplier || 'General'}</p>
                    </div>
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-semibold">Max: {b.stok_maksimum} {b.satuan}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Autosearch Nama Bahan */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Cari berdasarkan Nama Bahan (Auto-Search):</label>
            <input
              type="text"
              value={namaBarang}
              onChange={(e) => setNamaBarang(e.target.value)}
              placeholder="Ketik Nama Bahan untuk mencari..."
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 font-bold text-stone-900"
              required
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Quantity (Qty):</label>
            <input
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 text-stone-900 font-bold"
              required
            />
          </div>

          {/* Supplier (Locked from Master Data) */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1.5">
              <Truck size={14} className="text-blue-600" /> Supplier (Otomatis dari Master Data):
            </label>
            <input
              type="text"
              value={supplier}
              readOnly
              placeholder="Pilih SKU/Bahan terlebih dahulu..."
              className="w-full bg-stone-100 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-600 font-medium cursor-not-allowed select-none"
            />
          </div>

          {/* Nomor Surat Jalan */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1.5">
              <FileText size={14} className="text-emerald-600" /> Nomor Surat Jalan (No. SJ):
            </label>
            <div className="relative">
              <input
                type="text"
                value={noSj}
                onChange={(e) => setNoSj(e.target.value)}
                placeholder="Nomor SJ otomatis terisi atau ketik manual..."
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 font-mono text-stone-900 font-bold"
                required
              />
            </div>
            {suggestedSj && (
              <button
                type="button"
                onClick={() => setNoSj(suggestedSj)}
                className="mt-1.5 text-[11px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer bg-blue-50 px-2.5 py-1 rounded-lg w-fit"
              >
                <Sparkles size={12} /> Gunakan Saran No. SJ berikutnya: <span className="font-mono font-bold">{suggestedSj}</span>
              </button>
            )}
            {lastHistory && (
              <p className="text-[10px] text-stone-400 mt-1 flex items-center gap-1">
                <Clock size={11} /> Terakhir digunakan: <span className="font-mono font-semibold text-stone-600">{lastHistory.no_sj}</span> ({formatTimestamp(lastHistory.timestamp)})
              </p>
            )}
          </div>

          {/* Buttons */}
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
              disabled={loading}
              className="flex-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Simpan Data RFID & No. SJ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

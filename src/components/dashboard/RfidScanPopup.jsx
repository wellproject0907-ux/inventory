'use client';

import { useState, useEffect } from 'react';
import { db } from '@/services/firebase/config';
import { collection, query, where, onSnapshot, getDocs, orderBy, limit } from 'firebase/firestore';
import { Tag, Loader2, Check, Search, Truck, X, History, Clock, Sparkles } from 'lucide-react';

export default function RfidScanPopup() {
  const [pendingItem, setPendingItem] = useState(null);
  const [bahanList, setBahanList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBahan, setSelectedBahan] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

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

    return () => unsubscribe();
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
    if (confirm('Batalkan pendaftaran kartu ini?')) {
      try {
        await fetch(`/api/barang/${encodeURIComponent(pendingItem.nfc_uid)}`, {
          method: 'DELETE'
        }).catch(() => {});
        setPendingItem(null);
      } catch (err) {
        setPendingItem(null);
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!pendingItem || !selectedBahan) {
      alert('Pilih SKU dari Master Data terlebih dahulu!');
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
          no_sj: noSj || 'SJ-DEFAULT'
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
        alert('Gagal menyimpan detail barang');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan jaringan');
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-100 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Tag size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">Scan 1: Registrasi Barang Masuk (IN)</h3>
              <p className="text-xs text-stone-500">UID: <code className="bg-stone-100 px-1.5 py-0.5 rounded text-blue-600 font-mono">{pendingItem.nfc_uid}</code></p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition cursor-pointer"
            title="Cancel"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3.5 pt-2">
          {/* 1. Searchable SKU Input */}
          <div className="relative">
            <label className="block text-xs font-semibold text-stone-700 mb-1">Cari & Pilih SKU (Auto-Search):</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-stone-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Ketik SKU untuk mencari dari Master Data..."
                className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-blue-500 font-medium text-stone-900"
                required
              />
            </div>

            {/* Dropdown Auto-search */}
            {showDropdown && filteredBahan.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-stone-100">
                {filteredBahan.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => handleSelectBahan(b)}
                    className="p-2.5 hover:bg-blue-50 cursor-pointer text-xs transition"
                  >
                    <p className="font-bold text-blue-600">{b.sku || 'No SKU'}</p>
                    <p className="text-stone-800">{b.nama_bahan}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Histori Barang Masuk Terakhir */}
          {lastHistory && (
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 space-y-1.5 text-xs animate-fade-in">
              <div className="flex items-center gap-1.5 font-bold text-blue-800">
                <History size={14} /> Histori Barang Masuk Terakhir:
              </div>
              <div className="grid grid-cols-2 gap-2 text-stone-700 text-[11px]">
                <div>
                  <span className="text-stone-400 block text-[10px]">No. Surat Jalan (SJ):</span>
                  <strong className="font-mono text-blue-700">{lastHistory.no_sj || '-'}</strong>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px]">Supplier:</span>
                  <strong>{lastHistory.supplier || lastHistory.kategori || '-'}</strong>
                </div>
                <div className="col-span-2">
                  <span className="text-stone-400 block text-[10px]">Waktu Masuk Terakhir:</span>
                  <span className="flex items-center gap-1 text-stone-600">
                    <Clock size={11} /> {formatTimestamp(lastHistory.timestamp || lastHistory.scan_in_at)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 2. Item / Material Name (Auto-filled & Read-only) */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Nama Bahan (Terkunci / Read-Only):</label>
            <input
              type="text"
              value={namaBarang}
              readOnly
              className="w-full bg-stone-100 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none font-bold text-stone-700 cursor-not-allowed"
              required
            />
          </div>

          {/* 3. Qty (Set to 1) */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Quantity (Qty):</label>
            <input
              type="number"
              value={qty}
              readOnly
              className="w-full bg-stone-100 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none font-bold text-stone-700 cursor-not-allowed"
            />
          </div>

          {/* 4. Supplier (Terkunci sesuai item Master Data) */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Supplier (Otomatis & Terkunci dari Master Data):</label>
            <input
              type="text"
              value={supplier}
              readOnly
              className="w-full bg-stone-100 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none font-bold text-stone-700 cursor-not-allowed"
              required
            />
          </div>

          {/* 5. No. SJ (Surat Jalan) dengan Saran Otomatis */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Truck size={14} className="text-blue-600" /> Nomor Surat Jalan (No. SJ):</span>
              {suggestedSj && (
                <button
                  type="button"
                  onClick={() => setNoSj(suggestedSj)}
                  className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md transition cursor-pointer"
                  title="Klik untuk gunakan saran No. SJ berikutnya"
                >
                  <Sparkles size={12} /> Saran: {suggestedSj}
                </button>
              )}
            </label>
            <input
              type="text"
              list="sj-history"
              value={noSj}
              onChange={(e) => setNoSj(e.target.value)}
              placeholder="Nomor SJ otomatis terisi dari riwayat terakhir..."
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 font-mono text-stone-900 font-bold"
              required
            />
            <datalist id="sj-history">
              {sjHistory.map((sj, idx) => (
                <option key={idx} value={sj} />
              ))}
            </datalist>
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
              disabled={loading}
              className="flex-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer shadow-sm"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /> Simpan Data RFID & No. SJ</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

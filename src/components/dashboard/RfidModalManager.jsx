'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '@/services/firebase/config';
import { collection, query, where, onSnapshot, getDocs, orderBy, limit, deleteDoc, doc, setDoc, updateDoc, addDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { Tag, Loader2, Check, Search, Truck, X, History, Clock, Sparkles, ArrowDownLeft, FileText, AlertCircle, Users } from 'lucide-react';

export default function RfidModalManager() {
  const tabIdRef = useRef(typeof window !== 'undefined' ? Math.random().toString(36).substring(2, 9) : 'tab');
  const [activeModal, setActiveModal] = useState(null); // 'operator_auth', 'scan1', 'scan2', 'registered'
  const [itemData, setItemData] = useState(null);
  const [activeOperator, setActiveOperator] = useState({ name: 'Test Operator', role: 'Staff Gudang' });
  const [pendingAuthUid, setPendingAuthUid] = useState(null);

  // Scan 1 states
  const [bahanList, setBahanList] = useState([]);
  const [searchQuery, setSearchQuery] = useState(''); // SKU search
  const [searchNamaQuery, setSearchNamaQuery] = useState(''); // Nama Bahan search
  const [selectedBahan, setSelectedBahan] = useState(null);
  const [showDropdownSku, setShowDropdownSku] = useState(false);
  const [showDropdownNama, setShowDropdownNama] = useState(false);

  const [namaBarang, setNamaBarang] = useState('');
  const [supplier, setSupplier] = useState('');
  const [qty, setQty] = useState(1);
  const [noSj, setNoSj] = useState('');
  const [suggestedSj, setSuggestedSj] = useState('');
  const [sjHistory, setSjHistory] = useState([]);
  const [lastHistory, setLastHistory] = useState(null);

  // Scan 2 states
  const [noSpk, setNoSpk] = useState('');

  // Already registered states
  const [historyList, setHistoryList] = useState([]);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const bahanSnap = await getDocs(collection(db, 'bahan'));
        setBahanList(bahanSnap.docs.map(d => ({ id: d.id, ...d.data() })));

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

    // Listen to active operator and pending item auth from system settings
    const unsubSettings = onSnapshot(doc(db, 'system', 'settings'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.active_operator_name) {
          setActiveOperator({ name: data.active_operator_name, role: data.active_operator_role });
        } else {
          setActiveOperator(null);
        }

        if (data.pending_item_uid) {
          setPendingAuthUid(data.pending_item_uid);
          setActiveModal('operator_auth');
        } else if (activeModal === 'operator_auth') {
          setActiveModal(null);
          setPendingAuthUid(null);
        }
      }
    });

    // Listen to 'barang' collection in real-time with sessionStorage deduping (Zero database write overhead, 0% quota 429 risk)
    const unsubscribe = onSnapshot(collection(db, 'barang'), (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // PRIORITAS 1: Scan 1 - IN
      const inDoc = docs.find(d => {
        if (d.needs_naming !== true) return false;
        const key = 'handled_in_' + d.nfc_uid;
        if (typeof window !== 'undefined' && sessionStorage.getItem(key)) return false;
        return true;
      });

      if (inDoc) {
        if (typeof window !== 'undefined') sessionStorage.setItem('handled_in_' + inDoc.nfc_uid, 'true');
        setItemData(inDoc);
        setActiveModal('scan1');
        return;
      }

      // PRIORITAS 2: Already Registered
      const regDoc = docs.find(d => {
        if (d.needs_already_registered_popup !== true) return false;
        const key = 'handled_reg_' + d.nfc_uid;
        if (typeof window !== 'undefined' && sessionStorage.getItem(key)) return false;
        return true;
      });

      if (regDoc) {
        if (typeof window !== 'undefined') sessionStorage.setItem('handled_reg_' + regDoc.nfc_uid, 'true');
        setItemData(regDoc);
        setActiveModal('registered');
        fetchHistory(regDoc.nfc_uid);
        return;
      }

      // PRIORITAS 3: Scan 2 - OUT
      const outDoc = docs.find(d => {
        if (!(d.needs_spk === true && !d.needs_naming)) return false;
        const key = 'handled_out_' + d.nfc_uid;
        if (typeof window !== 'undefined' && sessionStorage.getItem(key)) return false;
        return true;
      });

      if (outDoc) {
        if (typeof window !== 'undefined') sessionStorage.setItem('handled_out_' + outDoc.nfc_uid, 'true');
        setItemData(outDoc);
        setActiveModal('scan2');
        return;
      }

      if (!pendingAuthUid) {
        setActiveModal(null);
        setItemData(null);
      }
    });

    return () => {
      unsubscribe();
      unsubSettings();
    };
  }, [pendingAuthUid, activeModal]);

  const fetchHistory = async (uid) => {
    try {
      const qTx = query(collection(db, 'riwayat_transaksi'), where('nfc_uid', '==', uid));
      const snap = await getDocs(qTx);
      setHistoryList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    }
  };

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
    setSearchNamaQuery(bahan.nama_bahan || '');
    setNamaBarang(bahan.nama_bahan || '');
    setShowDropdownSku(false);
    setShowDropdownNama(false);

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
      setLastHistory(null);
      setNoSj('');
      setSuggestedSj('');
    }
  };

  const handleCancelScan1 = async () => {
    if (!itemData) return;
    if (confirm('Batalkan pendaftaran kartu ini?')) {
      try {
        await deleteDoc(doc(db, 'barang', itemData.id));
        setActiveModal(null);
        setItemData(null);
      } catch (err) {
        setActiveModal(null);
      }
    }
  };

  const handleSaveScan1 = async (e) => {
    e.preventDefault();
    if (!itemData || (!selectedBahan && !namaBarang)) {
      alert('Pilih SKU atau Nama Bahan dari Master Data terlebih dahulu!');
      return;
    }

    const skuCode = selectedBahan ? (selectedBahan.sku || 'SKU') : 'SKU';
    const uniqueSuffix = itemData.nfc_uid.slice(-6);
    const generatedSkuId = `${skuCode}-${uniqueSuffix}`;

    try {
      setLoading(true);
      const res = await fetch('/api/arduino/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: itemData.nfc_uid,
          sku: generatedSkuId,
          nama_barang: namaBarang,
          kategori: supplier || 'General Supplier',
          qty: 1,
          no_sj: noSj || 'SJ-DEFAULT',
          warehouse_user: activeOperator?.name || 'Test Operator'
        })
      });

      if (res.ok) {
        setActiveModal(null);
        setItemData(null);
        setSearchQuery('');
        setSearchNamaQuery('');
        setSelectedBahan(null);
        setNamaBarang('');
        setSupplier('');
        setNoSj('');
        setSuggestedSj('');
        setLastHistory(null);
      } else {
        alert('Gagal menyimpan detail barang');
      }
    } catch (err) {
      alert('Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelScan2 = async () => {
    if (!itemData) return;
    try {
      await updateDoc(doc(db, 'barang', itemData.id), { needs_spk: false });
      setActiveModal(null);
      setItemData(null);
    } catch (e) {
      setActiveModal(null);
    }
  };

  const handleConfirmScan2 = async (e) => {
    e.preventDefault();
    if (!itemData || !noSpk) {
      alert('Nomor SPK wajib diisi!');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/arduino/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: itemData.nfc_uid,
          action: 'CONFIRM_OUT',
          no_spk: noSpk,
          warehouse_user: activeOperator?.name || 'Test Operator'
        })
      });

      if (res.ok) {
        setActiveModal(null);
        setItemData(null);
        setNoSpk('');
      } else {
        alert('Gagal mengkonfirmasi Stock OUT');
      }
    } catch (err) {
      alert('Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  const handleDismissRegistered = async () => {
    if (!itemData) return;
    try {
      await updateDoc(doc(db, 'barang', itemData.id), { needs_already_registered_popup: false });
      setActiveModal(null);
      setItemData(null);
    } catch (e) {
      setActiveModal(null);
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

  if (!activeModal) return null;

  // MODAL OPERATOR AUTH REQUIRED (PENDING ITEM SCAN)
  if (activeModal === 'operator_auth') {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-100 space-y-4 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto text-xl font-bold animate-pulse shadow-sm">
            ⚠️
          </div>
          <h3 className="text-lg font-bold text-stone-900">Operator Authorization Required</h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Item tag detected (<code className="font-mono text-blue-600">{pendingAuthUid}</code>). Please tap your **Operator ID Card** on the **Arduino RC522 reader** to authorize this transaction.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await updateDoc(doc(db, 'system', 'settings'), { pending_item_uid: null });
                } catch (e) {}
                setActiveModal(null);
                setPendingAuthUid(null);
              }}
              className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              Cancel / Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!itemData) return null;

  const filteredBahanSku = bahanList.filter(b => {
    const skuVal = b.sku || '';
    const q = searchQuery.toLowerCase();
    return skuVal.toLowerCase().includes(q);
  });

  const filteredBahanNama = bahanList.filter(b => {
    const nameVal = b.nama_bahan || '';
    const q = searchNamaQuery.toLowerCase();
    return nameVal.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
      {/* 1. MODAL SCAN 1 - IN */}
      {activeModal === 'scan1' && (
        <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-100 space-y-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Tag size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">Scan 1: Registrasi Barang Masuk (IN)</h3>
                <p className="text-xs text-stone-500">UID: <code className="bg-stone-100 px-1.5 py-0.5 rounded text-blue-600 font-mono">{itemData.nfc_uid}</code></p>
              </div>
            </div>
            <button onClick={handleCancelScan1} className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition cursor-pointer">
              <X size={20} />
            </button>
          </div>

          {/* Operator Authorization Status Banner */}
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between">
            <span>✅ Authorized Operator: <strong>{activeOperator?.name}</strong> ({activeOperator?.role || 'Staff Gudang'})</span>
          </div>

          <form onSubmit={handleSaveScan1} className="space-y-3.5 pt-2">
            {/* SKU Auto-Search */}
            <div className="relative">
              <label className="block text-xs font-semibold text-stone-700 mb-1">SKU</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-stone-400"><Search size={16} /></span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowDropdownSku(true); }}
                  onFocus={() => setShowDropdownSku(true)}
                  placeholder="Search SKU..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-blue-500 font-medium text-stone-900"
                />
              </div>
              {showDropdownSku && filteredBahanSku.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-40 overflow-y-auto divide-y divide-stone-100">
                  {filteredBahanSku.map((b) => (
                    <div key={b.id} onClick={() => handleSelectBahan(b)} className="p-2.5 hover:bg-blue-50 cursor-pointer text-xs transition">
                      <p className="font-bold text-blue-600">{b.sku || 'No SKU'}</p>
                      <p className="text-stone-800">{b.nama_bahan}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Nama Bahan Auto-Search */}
            <div className="relative">
              <label className="block text-xs font-semibold text-stone-700 mb-1">Material Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-stone-400"><Search size={16} /></span>
                <input
                  type="text"
                  value={searchNamaQuery}
                  onChange={(e) => {
                    setSearchNamaQuery(e.target.value);
                    setNamaBarang(e.target.value);
                    setShowDropdownNama(true);
                  }}
                  onFocus={() => setShowDropdownNama(true)}
                  placeholder="Search material name..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-blue-500 font-medium text-stone-900"
                  required
                />
              </div>
              {showDropdownNama && filteredBahanNama.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-40 overflow-y-auto divide-y divide-stone-100">
                  {filteredBahanNama.map((b) => (
                    <div key={b.id} onClick={() => handleSelectBahan(b)} className="p-2.5 hover:bg-blue-50 cursor-pointer text-xs transition">
                      <p className="font-bold text-stone-800">{b.nama_bahan}</p>
                      <p className="text-blue-600 font-mono text-[11px]">{b.sku || 'No SKU'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {lastHistory && (
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-blue-800"><History size={14} /> Last Incoming History:</div>
                <div className="grid grid-cols-2 gap-2 text-stone-700 text-[11px]">
                  <div><span className="text-stone-400 block text-[10px]">Delivery Order (SJ):</span><strong className="font-mono text-blue-700">{lastHistory.no_sj || '-'}</strong></div>
                  <div><span className="text-stone-400 block text-[10px]">Supplier:</span><strong>{lastHistory.supplier || lastHistory.kategori || '-'}</strong></div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Quantity</label>
              <input type="number" value={qty} readOnly className="w-full bg-stone-100 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none font-bold text-stone-700 cursor-not-allowed" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1.5">
                <Truck size={14} className="text-blue-600" /> Supplier
              </label>
              <input
                type="text"
                value={supplier}
                readOnly
                placeholder="Select material first..."
                className="w-full bg-stone-100 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-600 font-medium cursor-not-allowed select-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1.5">
                <FileText size={14} className="text-emerald-600" /> Delivery Order (SJ)
              </label>
              <input
                type="text"
                value={noSj}
                onChange={(e) => setNoSj(e.target.value)}
                placeholder="Enter or auto-fill SJ number..."
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 font-mono text-stone-900 font-bold"
                required
              />
              {suggestedSj && (
                <button
                  type="button"
                  onClick={() => setNoSj(suggestedSj)}
                  className="mt-1.5 text-[11px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer bg-blue-50 px-2.5 py-1 rounded-lg w-fit"
                >
                  <Sparkles size={12} /> Suggested next SJ: <span className="font-mono font-bold">{suggestedSj}</span>
                </button>
              )}
            </div>

            <div className="pt-3 flex gap-2">
              <button
                type="button"
                onClick={handleCancelScan1}
                className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Save Registration
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. MODAL SCAN 2 - OUT */}
      {activeModal === 'scan2' && (
        <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-100 space-y-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <ArrowDownLeft size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">Scan 2: Konfirmasi Stock OUT (Keluar)</h3>
                <p className="text-xs text-stone-500">UID: <code className="bg-stone-100 px-1.5 py-0.5 rounded text-blue-600 font-mono">{itemData.nfc_uid}</code></p>
              </div>
            </div>
            <button onClick={handleCancelScan2} className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition cursor-pointer">
              <X size={20} />
            </button>
          </div>

          {/* Operator Authorization Status Banner */}
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between">
            <span>✅ Authorized Operator: <strong>{activeOperator?.name}</strong> ({activeOperator?.role || 'Staff Gudang'})</span>
          </div>

          <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-4 space-y-2 text-xs">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Data Barang Saat Scan In:</p>
            <div className="grid grid-cols-2 gap-2 text-stone-700">
              <div><span className="text-stone-400 block text-[10px]">SKU:</span><strong className="font-mono text-blue-600">{itemData.sku || '-'}</strong>data</div>
              <div><span className="text-stone-400 block text-[10px]">Nama Bahan:</span><strong className="text-stone-900">{itemData.nama_barang || '-'}</strong></div>
              <div><span className="text-stone-400 block text-[10px]">Supplier:</span><span>{itemData.kategori || '-'}</span></div>
              <div><span className="text-stone-400 block text-[10px]">No. Surat Jalan (SJ):</span><span className="font-mono font-semibold">{itemData.no_sj || '-'}</span></div>
            </div>
          </div>

          <form onSubmit={handleConfirmScan2} className="space-y-3.5 pt-1">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1.5">
                <FileText size={14} className="text-amber-600" /> Work Order (SPK)
              </label>
              <input
                type="text"
                value={noSpk}
                onChange={(e) => setNoSpk(e.target.value)}
                placeholder="Enter work order number..."
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-500 font-mono text-stone-900 font-bold"
                required
                autoFocus
              />
            </div>

            <div className="pt-3 flex gap-2">
              <button
                type="button"
                onClick={handleCancelScan2}
                className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Confirm Stock Out
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. ALREADY REGISTERED */}
      {activeModal === 'registered' && (
        <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-100 space-y-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">Tag Already Registered</h3>
                <p className="text-xs text-stone-500">UID: <code className="bg-stone-100 px-1.5 py-0.5 rounded text-blue-600 font-mono">{itemData.nfc_uid}</code></p>
              </div>
            </div>
            <button onClick={handleDismissRegistered} className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition cursor-pointer">
              <X size={20} />
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl text-xs font-semibold">
            This NFC tag has completed its In and Out cycle. Reset or use another tag for new transactions.
          </div>

          <div className="pt-3">
            <button
              type="button"
              onClick={handleDismissRegistered}
              className="w-full bg-stone-900 hover:bg-stone-800 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer shadow-sm"
            >
              Close / Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

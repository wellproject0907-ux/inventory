'use client';

import { useState, useEffect } from 'react';
import { Scan, Radio, Plus, Layers, Search, CheckCircle2, AlertTriangle, Box, Trash2, ArrowUpRight, ArrowDownLeft, Lock, Info } from 'lucide-react';
import { CapacitorNfc } from '@capgo/capacitor-nfc';
import { db } from '@/services/firebase/config';
import { collection, getDocs, doc, setDoc, getDoc, addDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { subscribeToInventory } from '@/services/firebase/inventoryService';

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // NFC Scan state
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('Tap NTAG tag for Scan IN or Scan OUT');
  const [scannedUid, setScannedUid] = useState('');
  const [tagType, setTagType] = useState('NTAG 213 / 215');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false); // For Scan IN (New item registration)
  const [showOutModal, setShowOutModal] = useState(false);   // For Scan OUT (Existing item)
  const [existingItem, setExistingItem] = useState(null);

  // New Item Form state (Scan IN = 1x)
  const [namaBarang, setNamaBarang] = useState('');
  const [kategori, setKategori] = useState('');

  // Out Form state (Scan OUT)
  const [outKeterangan, setOutKeterangan] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeToInventory((fetchedItems) => {
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

  const parseTagUid = (event) => {
    const tag = event.tag || event;
    const records = tag.ndefMessage || tag.message?.records;

    if (records && records.length > 0) {
      const record = records[0];
      const payload = record.payload || record.data;
      if (payload) {
        try {
          const bytes = Array.isArray(payload) ? payload : Object.values(payload);
          const text = String.fromCharCode.apply(null, bytes.map(b => b & 0xFF));
          const cleanText = text.replace(/^[a-z]{2}/, '').trim();
          if (cleanText) return cleanText;
        } catch (e) {
          console.log('Error parsing NDEF payload:', e);
        }
      }
    }

    if (tag.id) {
      if (Array.isArray(tag.id)) {
        return tag.id.map(b => (b & 0xFF).toString(16).padStart(2, '0')).join(':').toUpperCase();
      }
      if (typeof tag.id === 'string') return tag.id;
      if (typeof tag.id === 'object') {
        const bytes = Object.values(tag.id);
        return bytes.map(b => (b & 0xFF).toString(16).padStart(2, '0')).join(':').toUpperCase();
      }
    }

    if (tag.serialNumber) return tag.serialNumber;

    return null;
  };

  const handleNfcScan = async () => {
    try {
      setScanning(true);
      setScanStatus('Listening for NTAG 213 / 215 tag (Native NFC Reader Mode)...');

      await CapacitorNfc.addListener('tagDiscovered', (event) => {
        setScanning(false);
        const uid = parseTagUid(event);
        if (!uid) {
          setScanStatus('Tag read but UID/NDEF is empty.');
          return;
        }
        setScanStatus(`NTAG Tag Successfully Scanned! UID/ID: ${uid}`);
        try { CapacitorNfc.stopScanning(); } catch (e) {}
        checkTagAndOpenModal(uid, 'NTAG 213/215 (Native)');
      });

      await CapacitorNfc.addListener('ndefDiscovered', (event) => {
        setScanning(false);
        const uid = parseTagUid(event);
        if (!uid) {
          setScanStatus('NDEF tag read but empty.');
          return;
        }
        setScanStatus(`NDEF Tag Successfully Scanned! UID/ID: ${uid}`);
        try { CapacitorNfc.stopScanning(); } catch (e) {}
        checkTagAndOpenModal(uid, 'NTAG 213/215 (NDEF)');
      });

      await CapacitorNfc.startScanning();
    } catch (nativeErr) {
      console.log('Native NFC fallback to Web NFC or Manual:', nativeErr);
      if ('NDEFReader' in window) {
        try {
          const ndef = new NDEFReader();
          await ndef.scan();
          ndef.onreading = (event) => {
            setScanning(false);
            const uid = parseTagUid(event) || event.serialNumber;
            if (!uid) return;
            setScanStatus(`Tag Successfully Scanned! UID: ${uid}`);
            checkTagAndOpenModal(uid, 'NTAG 213/215 (Web NFC)');
          };
          return;
        } catch (webErr) {
          console.log('Web NFC error:', webErr);
        }
      }

      setScanning(false);
      setScanStatus('NFC Reader active. Please enter tag UID/SKU manually.');
      const manual = prompt('Enter NTAG UID / SKU manually (e.g. ST-01):');
      if (manual) checkTagAndOpenModal(manual.trim(), 'Manual UID');
    }
  };

  // STRICT LOGIC:
  // - If NOT registered -> SCAN IN (Register new item, stock = 1, cannot be IN 2x)
  // - If ALREADY registered & stock > 0 -> SCAN OUT (Takes out 1 unit, stock becomes 0)
  // - If ALREADY registered & stock == 0 -> EXPIRED / COMPLETED (Locked, must delete & reset tag to reuse)
  const checkTagAndOpenModal = async (uid, type) => {
    setScannedUid(uid);
    setTagType(type);
    setMessage('');

    try {
      const docRef = doc(db, 'barang', String(uid));
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        // 1. SCAN IN: Tag not registered yet -> Register new item (Stock IN 1x)
        setNamaBarang('');
        setKategori('');
        setShowAddModal(true);
      } else {
        // 2. SCAN OUT / EXPIRED: Tag already registered
        const itemData = { id: docSnap.id, ...docSnap.data() };
        setExistingItem(itemData);
        setOutKeterangan('');
        setShowOutModal(true);
      }
    } catch (err) {
      console.error('Error checking tag in Firestore:', err);
      setNamaBarang('');
      setKategori('');
      setShowAddModal(true);
    }
  };

  // SAVE SCAN IN (New item, stock = 1)
  const handleScanInSubmit = async (e) => {
    e.preventDefault();
    if (!scannedUid || !namaBarang) {
      alert('UID and Item Name are required!');
      return;
    }

    try {
      setSubmitting(true);
      const docRef = doc(db, 'barang', String(scannedUid));

      await setDoc(docRef, {
        nfc_uid: String(scannedUid),
        nama_barang: String(namaBarang),
        kategori: String(kategori || 'General'),
        stok: 1, // Strict 1 item per scan lifecycle
        status_tag: 'Available',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });

      await addDoc(collection(db, 'riwayat_transaksi'), {
        nfc_uid: String(scannedUid),
        tipe: 'IN',
        jumlah: 1,
        keterangan: 'Scan IN (Item inbound 1x)',
        timestamp: serverTimestamp()
      });

      setSubmitting(false);
      setMessage(`✅ Scan IN Successful! Item "${namaBarang}" registered with stock 1 (Tag locked for this 1 item).`);
      setShowAddModal(false);
      setScannedUid('');
    } catch (err) {
      setSubmitting(false);
      alert('Failed to save Scan IN: ' + err.message);
    }
  };

  // SAVE SCAN OUT (Takes out stock, making it 0 / depleted)
  const handleScanOutSubmit = async (e) => {
    e.preventDefault();
    if (!existingItem || !scannedUid) {
      alert('Invalid transaction data.');
      return;
    }

    const currentStok = Number(existingItem.stok ?? 0);
    if (currentStok === 0) {
      alert('This NTAG tag is completed (Stock OUT fulfilled) and stock is depleted. Delete tag to reuse it.');
      return;
    }

    try {
      setSubmitting(true);

      // Update stock to 0 (Scan OUT completes the 1-item 1-scan cycle)
      const docRef = doc(db, 'barang', String(scannedUid));
      await setDoc(docRef, {
        stok: 0,
        status_tag: 'Completed (In/Out Fulfilled - Depleted)',
        updated_at: serverTimestamp()
      }, { merge: true });

      await addDoc(collection(db, 'riwayat_transaksi'), {
        nfc_uid: String(scannedUid),
        tipe: 'OUT',
        jumlah: currentStok,
        keterangan: outKeterangan || 'Scan OUT (In/Out cycle completed)',
        timestamp: serverTimestamp()
      });

      setSubmitting(false);
      setMessage(`⚠️ Scan OUT Successful! Item "${existingItem.nama_barang}" checked out (Stock 0). NTag Cycle Completed & Expired.`);
      setShowOutModal(false);
      setScannedUid('');
      setExistingItem(null);
    } catch (err) {
      setSubmitting(false);
      alert('Failed to process Scan OUT: ' + err.message);
    }
  };

  // DELETE ITEM FEATURE & PHYSICALLY ERASE NTAG
  const handleDeleteItem = async (id, nama, uid) => {
    if (confirm(`Are you sure you want to delete item "${nama}" (UID: ${uid})?\n\nData will be deleted from database and NTAG card will be physically erased for reuse.`)) {
      try {
        await deleteDoc(doc(db, 'barang', String(id)));

        try {
          await CapacitorNfc.erase();
        } catch (eraseErr) {
          console.log('Physical erase skipped or not supported on this tag:', eraseErr);
        }

        setMessage(`🗑️ Successfully deleted "${nama}". NTAG tag is now empty & ready for reuse.`);
      } catch (err) {
        alert('Failed to delete item: ' + err.message);
      }
    }
  };

  const filteredItems = items.filter(item =>
    item.nama_barang?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.nfc_uid?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.kategori?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full space-y-6 pb-24">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 text-blue-600 font-semibold text-xs uppercase tracking-wider mb-1">
            <Box size={16} /> Inventory & Warehouse Hub
          </div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Inventory Items</h1>
          <p className="text-stone-500 text-sm mt-0.5">
            List of all warehouse inventory items connected with RFID tags.
          </p>
        </div>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Items Table Section */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-stone-900">Warehouse Items List ({filteredItems.length})</h3>
            <p className="text-xs text-stone-500 mt-0.5">All registered items connected with NFC / NTAG tags</p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search item name or UID..."
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-4 py-2 text-xs outline-none focus:border-blue-500 transition"
            />
          </div>
        </div>

        <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-stone-50 shadow-xs">
              <tr className="bg-stone-50 text-[11px] font-bold text-stone-500 uppercase tracking-wider border-b border-stone-200">
                <th className="py-3 px-6">Item Name</th>
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
                  <td colSpan="7" className="text-center py-12 text-stone-400">Loading inventory data...</td>
                </tr>
              ) : filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const stok = Number(item.stok ?? 0);
                  const isDepleted = stok === 0;
                  return (
                    <tr key={item.id} className="hover:bg-stone-50/50 transition">
                      <td className="py-4 px-6 font-bold text-stone-900 min-w-[200px] max-w-[250px] break-words">{item.nama_barang}</td>
                      <td className="py-4 px-6 min-w-[220px] max-w-[260px] break-all whitespace-normal">
                        <p className="font-mono font-bold text-blue-600 break-all">{item.sku || '-'}</p>
                        <p className="text-[10px] text-stone-400 font-mono">UID: {item.nfc_uid}</p>
                      </td>
                      <td className="py-4 px-6 text-stone-600 min-w-[120px]">{item.kategori || 'General'}</td>
                      <td className="py-4 px-6 font-mono text-stone-600 text-[11px] min-w-[150px] whitespace-nowrap">
                        SJ: <span className="font-semibold text-stone-800">{item.no_sj || '-'}</span><br/>
                        SPK: <span className="font-semibold text-stone-800">{item.no_spk || '-'}</span>
                      </td>
                      <td className="py-4 px-6 text-stone-600 min-w-[130px] font-medium">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-stone-100 text-stone-700 border border-stone-200">
                          {item.warehouse_user || 'Warehouse Admin'}
                        </span>
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        {isDepleted ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                            <AlertTriangle size={12} /> Completed
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-200 inline-flex items-center gap-1">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteItem(item.id, item.nama_barang, item.nfc_uid)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-1.5 rounded-lg font-semibold text-xs transition cursor-pointer inline-flex items-center gap-1 ml-auto"
                          title="Delete item and erase tag"
                        >
                          <Trash2 size={13} /> Delete & Erase Tag
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-stone-400">
                    No items in inventory yet. Scan a new NFC tag to perform Scan IN.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Scan IN (Register New Item, Stock = 1) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-stone-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">{tagType} (New Tag)</span>
                <h3 className="text-base font-bold text-stone-900">Scan IN — Register New Item (1x)</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 transition cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-100 text-xs">
              <span className="text-stone-500">Detected Tag UID:</span>
              <p className="font-mono font-bold text-blue-700 text-sm mt-0.5">{scannedUid}</p>
              <p className="text-[11px] text-blue-600 mt-1">ℹ️ This tag has never been used (first & last Scan IN for this 1 item).</p>
            </div>

            <form onSubmit={handleScanInSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Item / Box Name:</label>
                <input
                  type="text"
                  value={namaBarang}
                  onChange={(e) => setNamaBarang(e.target.value)}
                  placeholder="Enter item name..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Category:</label>
                <input
                  type="text"
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value)}
                  placeholder="Enter category (optional)..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs text-stone-600">
                <strong>Automatic Stock:</strong> 1 Unit (Scan IN)
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Processing...' : 'Save Scan IN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Scan OUT (Existing Item) */}
      {showOutModal && existingItem && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-stone-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1">
                  <ArrowUpRight size={12} /> Tag Already Scanned IN (Existing Item)
                </span>
                <h3 className="text-base font-bold text-stone-900">Scan OUT — Check Out Item</h3>
              </div>
              <button
                onClick={() => setShowOutModal(false)}
                className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 transition cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Check if Stok is 0 (NTAG Expired / Completed) */}
            {Number(existingItem.stok ?? 0) === 0 ? (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl space-y-3 text-center">
                <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                  <Lock size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-rose-900 uppercase">🔴 NTAG Completed / Expired</h4>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                    Item <strong>{existingItem.nama_barang}</strong> has completed a full Scan IN and Scan OUT cycle. This NTAG tag is completed and inactive.
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowOutModal(false);
                      handleDeleteItem(existingItem.id, existingItem.nama_barang, scannedUid);
                    }}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Trash2 size={14} /> Delete & Erase Tag
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowOutModal(false)}
                    className="bg-stone-200 hover:bg-stone-300 text-stone-700 font-semibold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-rose-50/60 p-4 rounded-xl border border-rose-100 space-y-1">
                  <span className="text-[10px] font-bold text-rose-700 uppercase">ℹ️ Info: Tag Already Scanned IN</span>
                  <h4 className="text-sm font-bold text-stone-900">{existingItem.nama_barang}</h4>
                  <p className="text-xs text-stone-600">Category: {existingItem.kategori || 'General'}</p>
                  <p className="text-xs text-stone-600">Current Stock: <strong className="text-blue-600">{existingItem.stok ?? 0} unit</strong></p>
                  <p className="text-[10px] text-stone-400 font-mono mt-1">UID: {scannedUid}</p>
                </div>

                <form onSubmit={handleScanOutSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Scan OUT Notes (Optional):</label>
                    <input
                      type="text"
                      value={outKeterangan}
                      onChange={(e) => setOutKeterangan(e.target.value)}
                      placeholder="Example: Outbound shipment / delivery"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs outline-none focus:border-rose-500"
                    />
                  </div>

                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs text-stone-600">
                    ℹ️ Performing Scan OUT will check out all remaining stock (1 unit) and complete this NTAG tag cycle.
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowOutModal(false)}
                      className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      {submitting ? 'Processing...' : 'Confirm Scan OUT'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

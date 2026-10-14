'use client';

import { useState, useEffect } from 'react';
import { db } from '@/services/firebase/config';
import { collection, getDocs, deleteDoc, doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { Database, Plus, RefreshCw, Trash2, Building2, Package, Users, Scan, Search, Check, X, Tag, FileSpreadsheet, AlertTriangle } from 'lucide-react';

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState('bahan'); // 'bahan', 'suplier', or 'operator'
  const [bahanList, setBahanList] = useState([]);
  const [suplierList, setSuplierList] = useState([]);
  const [operatorList, setOperatorList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Single Add Material Modal state
  const [showModal, setShowModal] = useState(false);
  const [sku, setSku] = useState('');
  const [namaBahan, setNamaBahan] = useState('');
  const [stokMaksimum, setStokMaksimum] = useState(0);
  const [satuan, setSatuan] = useState('Pcs');
  const [supplier, setSupplier] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Add Operator Modal state
  const [showOperatorModal, setShowOperatorModal] = useState(false);
  const [opNama, setOpNama] = useState('');
  const [opUid, setOpUid] = useState('');
  const [opRole, setOpRole] = useState('Staff Gudang');
  const [opSubmitting, setOpSubmitting] = useState(false);

  // Add Supplier Modal state
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [isEditSup, setIsEditSup] = useState(false);
  const [supIdEdit, setSupIdEdit] = useState('');
  const [supNama, setSupNama] = useState('');
  const [supPic, setSupPic] = useState('');
  const [supTelp, setSupTelp] = useState('');
  const [supAlamat, setSupAlamat] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supTop, setSupTop] = useState('');
  const [supStatus, setSupStatus] = useState('Active');
  const [supSubmitting, setSupSubmitting] = useState(false);

  const [txInboundList, setTxInboundList] = useState([]);

  // Card Scan Modal state (for Arduino hardware reader / Web NFC)
  const [showCardScanModal, setShowCardScanModal] = useState(false);
  const [tempCardUid, setTempCardUid] = useState('');

  // Bulk Import Modal state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const bahanSnap = await getDocs(collection(db, 'bahan'));
      setBahanList(bahanSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const suplierSnap = await getDocs(collection(db, 'suplier'));
      setSuplierList(suplierSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const operatorSnap = await getDocs(collection(db, 'operator'));
      setOperatorList(operatorSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const txSnap = await getDocs(collection(db, 'riwayat_transaksi'));
      setTxInboundList(txSnap.docs.map(doc => doc.data()).filter(tx => tx.tipe === 'IN'));

    } catch (err) {
      console.error('Error fetching master data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Listen to hardware Arduino RC522 scans when Card Scan Modal is open
  useEffect(() => {
    if (!showCardScanModal) return;

    const unsubscribe = onSnapshot(doc(db, 'system', 'settings'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.last_scanned_uid) {
          const scannedAt = data.last_scanned_at?.toMillis ? data.last_scanned_at.toMillis() : 0;
          if (Date.now() - scannedAt < 5000) {
            const uid = data.last_scanned_uid;
            setOpUid(uid.trim());
            setOpNama('');
            setOpRole('Staff Gudang');
            setShowCardScanModal(false);
            setShowOperatorModal(true);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [showCardScanModal]);

  const startScanForOperator = async () => {
    // Open the scan modal which listens to hardware Arduino scans & allows manual/simulate entry
    setShowCardScanModal(true);
    setTempCardUid('');

    // Also attempt Web NFC if supported
    if ('NDEFReader' in window) {
      try {
        const ndef = new NDEFReader();
        await ndef.scan();
        ndef.addEventListener('reading', ({ serialNumber, message }) => {
          let uid = serialNumber;
          if (message && message.records && message.records.length > 0) {
            const record = message.records[0];
            if (record.recordType === 'text') {
              const td = new TextDecoder(record.encoding || 'utf-8');
              uid = td.decode(record.data);
            }
          }
          const cleanUid = uid || serialNumber;
          setOpUid(cleanUid.trim());
          setOpNama('');
          setOpRole('Staff Gudang');
          setShowCardScanModal(false);
          setShowOperatorModal(true);
        }, { once: true });
      } catch (err) {}
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!sku || !namaBahan) {
      alert('SKU and Material Name are required!');
      return;
    }

    try {
      setSubmitting(true);
      const docId = String(sku).toLowerCase().replace(/[^a-z0-9]/g, '_');
      const docRef = doc(db, 'bahan', docId);

      const payload = {
        sku: sku.trim(),
        nama_bahan: namaBahan.trim(),
        stok_maksimum: Number(stokMaksimum) || 0,
        satuan: satuan.trim(),
        supplier: supplier.trim() || 'General Supplier',
        updated_at: serverTimestamp()
      };

      await setDoc(docRef, payload);

      if (supplier && supplier !== 'General Supplier') {
        const supId = String(supplier).toLowerCase().replace(/[^a-z0-9]/g, '_');
        await setDoc(doc(db, 'suplier', supId), {
          nama_suplier: supplier.trim(),
          updated_at: serverTimestamp()
        }, { merge: true });
      }

      setSubmitting(false);
      setShowModal(false);
      setSku('');
      setNamaBahan('');
      setStokMaksimum(0);
      setSatuan('Pcs');
      setSupplier('');
      fetchData();
    } catch (err) {
      setSubmitting(false);
      alert('Failed to save master data.');
    }
  };

  const handleOperatorSubmit = async (e) => {
    e.preventDefault();
    if (!opNama || !opUid) {
      alert('Operator Name and NFC UID are required!');
      return;
    }

    try {
      setOpSubmitting(true);
      const docId = String(opUid).trim();
      await setDoc(doc(db, 'operator', docId), {
        nfc_uid: opUid.trim(),
        nama_operator: opNama.trim(),
        role: opRole.trim(),
        updated_at: serverTimestamp()
      });

      setOpSubmitting(false);
      setShowOperatorModal(false);
      setOpNama('');
      setOpUid('');
      setOpRole('Staff Gudang');
      fetchData();
  const handleSupplierSubmit = async (e) => {
    e.preventDefault();
    if (!supNama) {
      alert('Supplier Name is required!');
      return;
    }

    try {
      setSupSubmitting(true);
      const supId = isEditSup ? supIdEdit : String(supNama).toLowerCase().replace(/[^a-z0-9]/g, '_');
      await setDoc(doc(db, 'suplier', supId), {
        nama_suplier: supNama.trim(),
        pic: supPic.trim(),
        telepon: supTelp.trim(),
        alamat: supAlamat.trim(),
        email: supEmail.trim(),
        top: supTop.trim(),
        status: supStatus,
        updated_at: serverTimestamp()
      }, { merge: true });

      setSupSubmitting(false);
      setShowSupplierModal(false);
      setSupNama('');
      setSupPic('');
      setSupTelp('');
      setSupAlamat('');
      setSupEmail('');
      setSupTop('');
      setSupStatus('Active');
      setIsEditSup(false);
      setSupIdEdit('');
      fetchData();
    } catch (err) {
      setSupSubmitting(false);
      alert('Failed to save supplier data.');
    }
  };

  const openEditSupplier = (supplierItem) => {
    setSupNama(supplierItem.nama_suplier || supplierItem.id);
    setSupPic(supplierItem.pic || '');
    setSupTelp(supplierItem.telepon || '');
    setSupAlamat(supplierItem.alamat || '');
    setSupEmail(supplierItem.email || '');
    setSupTop(supplierItem.top || '');
    setSupStatus(supplierItem.status || 'Active');
    setSupIdEdit(supplierItem.id);
    setIsEditSup(true);
    setShowSupplierModal(true);
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (!bulkText.trim()) {
      alert('Please paste data from Excel first!');
      return;
    }

    try {
      setBulkSubmitting(true);
      const lines = bulkText.split('\n').filter(line => line.trim() !== '');
      let count = 0;
      const uniqueSuppliers = new Set();

      for (const line of lines) {
        const cols = line.split(line.includes('\t') ? '\t' : ',').map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 2) continue;

        const rowSku = cols[0] || `SKU-${Math.random().toString(36).substring(2, 7)}`;
        const rowBahan = cols[1] || rowSku;
        const rowStokMax = Number(cols[2] || 0);
        const rowSatuan = cols[3] || 'Pcs';
        const rowSupplier = cols[4] || 'General Supplier';

        const docId = String(rowSku || rowBahan).toLowerCase().replace(/[^a-z0-9]/g, '_');
        const docRef = doc(db, 'bahan', docId);

        await setDoc(docRef, {
          sku: rowSku,
          nama_bahan: rowBahan,
          stok_maksimum: isNaN(rowStokMax) ? 0 : rowStokMax,
          satuan: rowSatuan,
          supplier: rowSupplier,
          updated_at: serverTimestamp()
        });

        if (rowSupplier && rowSupplier !== 'General Supplier' && rowSupplier !== '-') {
          uniqueSuppliers.add(rowSupplier);
        }
        count++;
      }

      for (const supName of uniqueSuppliers) {
        const supId = String(supName).toLowerCase().replace(/[^a-z0-9]/g, '_');
        await setDoc(doc(db, 'suplier', supId), {
          nama_suplier: supName,
          updated_at: serverTimestamp()
        }, { merge: true });
      }

      setBulkSubmitting(false);
      setShowBulkModal(false);
      setBulkText('');
      alert(`Successfully imported ${count} master data records in bulk!`);
      fetchData();
    } catch (err) {
      setBulkSubmitting(false);
      alert('Failed to perform bulk import.');
    }
  };

  const handleClearAllData = async () => {
    if (!confirm('WARNING: Are you sure you want to PERMANENTLY DELETE ALL DATA?')) return;
    try {
      setClearing(true);
      const res = await fetch('/api/master-data/clear', { method: 'POST' });
      if (res.ok) {
        alert('All data deleted successfully.');
        fetchData();
      } else {
        alert('Failed to delete data.');
      }
    } catch (err) {
      alert('A network error occurred.');
    } finally {
      setClearing(false);
    }
  };

  const handleDelete = async (type, id) => {
    if (!confirm('Are you sure you want to delete this master data?')) return;
    try {
      await deleteDoc(doc(db, type, id));
      fetchData();
    } catch (err) {
      alert('Failed to delete data.');
    }
  };

  const filteredBahan = bahanList.filter(item => {
    if (!item) return false;
    const s = String(item.sku || '').toLowerCase();
    const n = String(item.nama_bahan || '').toLowerCase();
    const sup = String(item.supplier || '').toLowerCase();
    const q = String(searchQuery || '').toLowerCase();
    return s.includes(q) || n.includes(q) || sup.includes(q);
  });

  const filteredSuplier = suplierList.filter(item => {
    if (!item) return false;
    const n = String(item.nama_suplier || '').toLowerCase();
    const id = String(item.id || '').toLowerCase();
    const q = String(searchQuery || '').toLowerCase();
    return n.includes(q) || id.includes(q);
  });

  const filteredOperator = operatorList.filter(item => {
    if (!item) return false;
    const n = String(item.nama_operator || '').toLowerCase();
    const uid = String(item.nfc_uid || '').toLowerCase();
    const r = String(item.role || '').toLowerCase();
    const q = String(searchQuery || '').toLowerCase();
    return n.includes(q) || uid.includes(q) || r.includes(q);
  });

  return (
    <div className="w-full space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <Database className="text-blue-600" size={24} /> Master Data Management
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">Manage material, supplier, and authorized operator data.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClearAllData}
            disabled={clearing}
            className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold px-3 py-2 rounded-xl text-xs transition cursor-pointer shadow-sm disabled:opacity-50"
          >
            <AlertTriangle size={14} /> Delete All
          </button>
          {activeTab === 'bahan' && (
            <>
              <button
                onClick={() => setShowBulkModal(true)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer shadow-sm"
              >
                <FileSpreadsheet size={16} /> Import Excel
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer shadow-sm"
              >
                <Plus size={16} /> Add Material
              </button>
            </>
          )}
          {activeTab === 'operator' && (
            <button
              onClick={startScanForOperator}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer shadow-sm"
            >
              <Scan size={16} /> Scan Card
            </button>
          )}
          {activeTab === 'suplier' && (
            <button
              onClick={() => setShowSupplierModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer shadow-sm"
            >
              <Plus size={16} /> Add Supplier
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-stone-200/70 p-1 rounded-xl w-fit">
        <button
          onClick={() => { setActiveTab('bahan'); setSearchQuery(''); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
            activeTab === 'bahan' ? 'bg-white text-blue-600 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Package size={16} /> Materials ({bahanList.length})
        </button>
        <button
          onClick={() => { setActiveTab('suplier'); setSearchQuery(''); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
            activeTab === 'suplier' ? 'bg-white text-blue-600 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Building2 size={16} /> Suppliers ({suplierList.length})
        </button>
        <button
          onClick={() => { setActiveTab('operator'); setSearchQuery(''); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
            activeTab === 'operator' ? 'bg-white text-blue-600 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Users size={16} /> Operators ({operatorList.length})
        </button>
      </div>

      {/* Data Table with Search */}
      <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-stone-100 flex flex-col md:flex-row justify-between items-center gap-3">
          <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
            {activeTab === 'bahan' ? 'Master Material Data' : activeTab === 'suplier' ? 'Master Supplier List' : 'Authorized Operators & Staff'}
          </h4>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-stone-400">
                <Search size={14} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'operator' ? 'Search operator name, UID, role...' : 'Search SKU, material name, supplier...'}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-1.5 text-xs outline-none focus:border-blue-500 text-stone-900"
              />
            </div>
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer shrink-0"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-xs text-stone-400">Loading data from Firebase...</div>
          ) : activeTab === 'bahan' ? (
            filteredBahan.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-400">No material data in Firebase yet. Click "Bulk Import (Excel)" or "Add Material".</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-20 bg-stone-50 shadow-xs">
                  <tr className="bg-stone-50 border-b border-stone-100 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    <th className="p-3.5">SKU</th>
                    <th className="p-3.5">Material Name</th>
                    <th className="p-3.5 text-center">Max Stock</th>
                    <th className="p-3.5 text-center">Unit</th>
                    <th className="p-3.5">Supplier</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs text-stone-800">
                  {filteredBahan.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50/50 transition">
                      <td className="p-3.5 font-mono font-bold text-blue-600">{item.sku || '-'}</td>
                      <td className="p-3.5 font-bold text-stone-900">{item.nama_bahan || '-'}</td>
                      <td className="p-3.5 text-center font-bold text-emerald-600">{item.stok_maksimum || 0}</td>
                      <td className="p-3.5 text-center text-stone-600">{item.satuan || 'Pcs'}</td>
                      <td className="p-3.5 font-medium text-stone-700">{item.supplier || '-'}</td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleDelete('bahan', item.id)}
                          className="w-7 h-7 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition cursor-pointer ml-auto shadow-2xs"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : activeTab === 'suplier' ? (
            filteredSuplier.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-400">No supplier data in Firebase yet.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-20 bg-stone-50 shadow-xs">
                  <tr className="bg-stone-50 border-b border-stone-100 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    <th className="p-3.5">Supplier Name</th>
                    <th className="p-3.5">Contact Person (PIC)</th>
                    <th className="p-3.5">Commercials</th>
                    <th className="p-3.5">Metrics</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs text-stone-800">
                  {filteredSuplier.map((item) => {
                    const suplierName = item.nama_suplier || item.id;
                    const totalSku = bahanList.filter(b => b.supplier === suplierName).length;
                    const totalInbound = txInboundList.filter(tx => {
                      const bahan = bahanList.find(b => b.sku === tx.sku);
                      return bahan && bahan.supplier === suplierName;
                    }).length;

                    return (
                      <tr key={item.id} className="hover:bg-stone-50/50 transition">
                        <td className="p-3.5">
                          <p className="font-bold text-stone-900">{suplierName}</p>
                          <p className="text-[10px] text-stone-500 max-w-[150px] truncate">{item.alamat || '-'}</p>
                        </td>
                        <td className="p-3.5">
                          <p className="font-bold text-stone-700">{item.pic || '-'}</p>
                          {item.telepon && (
                            <a href={`https://wa.me/${item.telepon.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-emerald-600 hover:underline">
                              WhatsApp: {item.telepon}
                            </a>
                          )}
                        </td>
                        <td className="p-3.5">
                          <p className="text-stone-600">Email: {item.email || '-'}</p>
                          <p className="text-stone-600">TOP: {item.top || '-'}</p>
                        </td>
                        <td className="p-3.5">
                          <div className="flex gap-2">
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-200">
                              {totalSku} SKUs
                            </span>
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-200">
                              {totalInbound} Inbounds
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${
                            item.status === 'Inactive' ? 'bg-stone-100 text-stone-600 border-stone-200' :
                            item.status === 'Blacklisted' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                            'bg-emerald-100 text-emerald-700 border-emerald-200'
                          }`}>
                            {item.status || 'Active'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                window.location.href = `/inbound?search=${encodeURIComponent(suplierName)}`;
                              }}
                              className="px-2 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-semibold transition cursor-pointer text-[10px] border border-indigo-200"
                              title="View Inbound History"
                            >
                              History
                            </button>
                            <button
                              onClick={() => openEditSupplier(item)}
                              className="px-2 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold transition cursor-pointer text-[10px] border border-blue-200"
                              title="Edit Supplier"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete('suplier', item.id)}
                              className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition cursor-pointer shadow-2xs border border-rose-100"
                              title="Delete Supplier"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : (
            filteredOperator.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-400">No operators registered yet. Click "Scan Card" to register.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-20 bg-stone-50 shadow-xs">
                  <tr className="bg-stone-50 border-b border-stone-100 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    <th className="p-3.5">Operator Name</th>
                    <th className="p-3.5">NFC / ID Card UID</th>
                    <th className="p-3.5">Role / Position</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs text-stone-800">
                  {filteredOperator.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50/50 transition">
                      <td className="p-3.5 font-bold text-stone-900 flex items-center gap-2">
                        <Users size={14} className="text-blue-600" /> {item.nama_operator || '-'}
                      </td>
                      <td className="p-3.5 font-mono text-blue-600 font-semibold">{item.nfc_uid || '-'}</td>
                      <td className="p-3.5 text-stone-700 font-medium">{item.role || 'Staff Gudang'}</td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleDelete('operator', item.id)}
                          className="w-7 h-7 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition cursor-pointer ml-auto shadow-2xs"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      {/* Card Scan Modal for Hardware Arduino / WebNFC */}
      {showCardScanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-stone-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold animate-pulse">
                  <Scan size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">Waiting for Card Scan</h3>
                  <p className="text-xs text-stone-500">Tap your RFID card on Arduino reader</p>
                </div>
              </div>
              <button
                onClick={() => setShowCardScanModal(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 pt-2 text-center">
              <div className="py-8 bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center animate-bounce">
                  <Scan size={24} />
                </div>
                <p className="text-xs font-bold text-stone-800">Please tap your ID card on the Arduino RC522 reader</p>
                <p className="text-[10px] text-stone-400">The popup will open automatically once detected.</p>
              </div>

              {/* Simulation fallback for testing without physical hardware */}
              <div className="pt-2 border-t border-stone-100">
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">Or Simulate Card UID:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tempCardUid}
                    onChange={(e) => setTempCardUid(e.target.value)}
                    placeholder="e.g. OP-999"
                    className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-mono text-stone-900 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!tempCardUid.trim()) return;
                      setOpUid(tempCardUid.trim());
                      setOpNama('');
                      setOpRole('Staff Gudang');
                      setShowCardScanModal(false);
                      setShowOperatorModal(true);
                    }}
                    className="bg-blue-600 text-white px-3 py-2 rounded-xl text-xs font-semibold hover:bg-blue-700 transition cursor-pointer"
                  >
                    Use UID
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCardScanModal(false)}
                  className="w-full py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Operator Modal */}
      {showOperatorModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">Add Authorized Operator</h3>
                  <p className="text-xs text-stone-500">Register employee ID card for scan authorization</p>
                </div>
              </div>
              <button
                onClick={() => setShowOperatorModal(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleOperatorSubmit} className="space-y-3.5 pt-2">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">NFC / ID Card UID:</label>
                <input
                  type="text"
                  value={opUid}
                  onChange={(e) => setOpUid(e.target.value)}
                  placeholder="Example: OP-CARD-001 or NFC UID"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 font-mono text-stone-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Operator Name:</label>
                <input
                  type="text"
                  value={opNama}
                  onChange={(e) => setOpNama(e.target.value)}
                  placeholder="Example: Budi Santoso"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 font-bold text-stone-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Role / Position:</label>
                <select
                  value={opRole}
                  onChange={(e) => setOpRole(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 text-stone-900"
                >
                  <option value="Staff Gudang">Staff Gudang</option>
                  <option value="Helper Gudang">Helper Gudang</option>
                  <option value="Security">Security</option>
                  <option value="Super Admin">Super Admin</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowOperatorModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={opSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {opSubmitting ? 'Saving...' : 'Save Operator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-100 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900">Add New Supplier</h3>
              <button
                onClick={() => setShowSupplierModal(false)}
                className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 transition cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSupplierSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Supplier Name / Company:</label>
                <input
                  type="text"
                  value={supNama}
                  onChange={(e) => setSupNama(e.target.value)}
                  placeholder="e.g. PT Mitra Sejahtera"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Contact Person (PIC):</label>
                <input
                  type="text"
                  value={supPic}
                  onChange={(e) => setSupPic(e.target.value)}
                  placeholder="e.g. Bpk. Andi"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Phone / WhatsApp:</label>
                <input
                  type="text"
                  value={supTelp}
                  onChange={(e) => setSupTelp(e.target.value)}
                  placeholder="e.g. 08123456789"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Official Email:</label>
                <input
                  type="email"
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  placeholder="e.g. sales@mitrasejahtera.com"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Payment Term (TOP):</label>
                <input
                  type="text"
                  value={supTop}
                  onChange={(e) => setSupTop(e.target.value)}
                  placeholder="e.g. Net 30 Days, COD"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Address:</label>
                <textarea
                  value={supAlamat}
                  onChange={(e) => setSupAlamat(e.target.value)}
                  placeholder="Supplier office or warehouse address..."
                  rows={2}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Status:</label>
                <select
                  value={supStatus}
                  onChange={(e) => setSupStatus(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs outline-none focus:border-blue-500"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Blacklisted">Blacklisted</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSupplierModal(false);
                    setIsEditSup(false);
                  }}
                  className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={supSubmitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {supSubmitting ? 'Saving...' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Single Material Modal header section modal check */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Tag size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">Add Material Master</h3>
                  <p className="text-xs text-stone-500">Save directly to Firebase database</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5 pt-2">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">SKU Number:</label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Example: MAT-ECO-STC-..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 font-mono text-stone-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Material Name:</label>
                <input
                  type="text"
                  value={namaBahan}
                  onChange={(e) => setNamaBahan(e.target.value)}
                  placeholder="Example: Clear Acrylic 3mm"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 font-bold text-stone-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Max Stock:</label>
                <input
                  type="number"
                  value={stokMaksimum}
                  onChange={(e) => setStokMaksimum(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 text-stone-900 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Unit:</label>
                <input
                  type="text"
                  value={satuan}
                  onChange={(e) => setSatuan(e.target.value)}
                  placeholder="Pcs, Roll, Botol, etc."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 text-stone-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 smb-1">Supplier Name:</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Supplier name or General Supplier"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 text-stone-900 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">Bulk Import Materials</h3>
                  <p className="text-xs text-stone-500">Paste Excel/CSV data (Tab or comma separated)</p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleBulkSubmit} className="space-y-3.5 pt-2">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Paste Data (Columns: SKU, Name, Max Stock, Unit, Supplier):
                </label>
                <textarea
                  rows={8}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="SKU-001	Material Name	100	Pcs	PT Supplier A&#10;SKU-002	Material Name 2	50	Roll	PT Supplier B"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs outline-none focus:border-blue-500 font-mono text-stone-900"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { db } from '@/services/firebase/config';
import { collection, getDocs, deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Database, Plus, RefreshCw, Trash2, Building2, Package, Search, Check, X, Tag, FileSpreadsheet, AlertTriangle } from 'lucide-react';

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState('bahan'); // 'bahan' or 'suplier'
  const [bahanList, setBahanList] = useState([]);
  const [suplierList, setSuplierList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Single Add Modal state
  const [showModal, setShowModal] = useState(false);
  const [sku, setSku] = useState('');
  const [namaBahan, setNamaBahan] = useState('');
  const [stokMaksimum, setStokMaksimum] = useState(0);
  const [satuan, setSatuan] = useState('Pcs');
  const [supplier, setSupplier] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    } catch (err) {
      console.error('Error fetching master data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  return (
    <div className="w-full space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <Database className="text-blue-600" size={24} /> Master Data Management
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">Manage material and supplier data.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClearAllData}
            disabled={clearing}
            className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold px-3 py-2 rounded-xl text-xs transition cursor-pointer shadow-sm disabled:opacity-50"
          >
            <AlertTriangle size={14} /> Delete All Data
          </button>
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer shadow-sm"
          >
            <FileSpreadsheet size={16} /> Bulk Import (Excel)
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer shadow-sm"
          >
            <Plus size={16} /> Add Material
          </button>
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
      </div>

      {/* Data Table with Search */}
      <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-stone-100 flex flex-col md:flex-row justify-between items-center gap-3">
          <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
            {activeTab === 'bahan' ? 'Master Material Data' : 'Master Supplier List'}
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
                placeholder="Search SKU, material name, supplier..."
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

        <div className="overflow-x-auto">
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
          ) : (
            filteredSuplier.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-400">No supplier data in Firebase yet.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-20 bg-stone-50 shadow-xs">
                  <tr className="bg-stone-50 border-b border-stone-100 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    <th className="p-3.5">Supplier Name</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs text-stone-800">
                  {filteredSuplier.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50/50 transition">
                      <td className="p-3.5 font-bold text-stone-900">{item.nama_suplier || item.id}</td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleDelete('suplier', item.id)}
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

      {/* Add Single Modal */}
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
                <label className="block text-xs font-semibold text-stone-700 mb-1">Maximum Stock:</label>
                <input
                  type="number"
                  min="0"
                  value={stokMaksimum}
                  onChange={(e) => setStokMaksimum(e.target.value)}
                  placeholder="10, 40, etc..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 font-bold text-stone-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Unit:</label>
                <input
                  type="text"
                  value={satuan}
                  onChange={(e) => setSatuan(e.target.value)}
                  placeholder="Pcs, Roll, Gallon, Meter..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 text-stone-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Supplier:</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Supplier / vendor name..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 text-stone-900"
                  required
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer shadow-sm"
                >
                  {submitting ? <RefreshCw size={16} className="animate-spin" /> : <><Check size={16} /> Save to Firebase</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-stone-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">Bulk Import (Copy-Paste from Excel)</h3>
                  <p className="text-xs text-stone-500">Copy multiple rows from Excel, then paste below</p>
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
                  Paste Data (Column Format: <code>SKU [Tab] Material Name [Tab] Maximum Stock [Tab] Unit [Tab] Supplier</code>):
                </label>
                <textarea
                  rows={8}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="MAT-001	Clear Acrylic 3mm	10	Pcs	Colorful&#10;MAT-002	Albatros Dye	5	Roll	Paper Works"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs outline-none focus:border-blue-500 font-mono text-stone-900"
                  required
                />
                <p className="text-[11px] text-stone-400 mt-1">
                  *Ensure when copying from Excel the order is: <strong>SKU</strong>, <strong>Material Name</strong>, <strong>Maximum Stock</strong>, <strong>Unit</strong>, <strong>Supplier</strong>.
                </p>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkSubmitting}
                  className="flex-2 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer shadow-sm"
                >
                  {bulkSubmitting ? <RefreshCw size={16} className="animate-spin" /> : <><Check size={16} /> Process Bulk Import</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

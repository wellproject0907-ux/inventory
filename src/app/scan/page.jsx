'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '@/services/firebase/config';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Scan, Radio, Loader2, Cpu, Users, ShieldCheck } from 'lucide-react';

export default function ScanPage() {
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('Ready to read NFC tag automatically');
  const [scannedUid, setScannedUid] = useState('');
  const [foundItem, setFoundItem] = useState(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [manualUid, setManualUid] = useState('');

  // Operator Authorization state
  const [authorizedOperator, setAuthorizedOperator] = useState(null);
  const authorizedOperatorRef = useRef(null);
  const [operatorScanning, setOperatorScanning] = useState(false);
  const [operatorStatus, setOperatorStatus] = useState('Tap to scan staff/operator ID card');

  useEffect(() => {
    authorizedOperatorRef.current = authorizedOperator;
  }, [authorizedOperator]);

  // Listen to real-time hardware Arduino RC522 scans
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'system', 'settings'), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.last_scanned_uid) {
          const scannedAt = data.last_scanned_at?.toMillis ? data.last_scanned_at.toMillis() : 0;
          if (Date.now() - scannedAt < 5000) {
            const uid = data.last_scanned_uid;

            // 1. Check if scanned card is an operator card
            try {
              const opDoc = await getDoc(doc(db, 'operator', uid));
              if (opDoc.exists()) {
                const opData = opDoc.data();
                setAuthorizedOperator({ nfc_uid: uid, ...opData });
                return;
              }
            } catch (e) {}

            // 2. If not operator card, check if operator is authorized
            if (authorizedOperatorRef.current) {
              handleScannedUid(uid);
            } else {
              alert('⚠️ Operator Authorization Required! Please scan Operator ID Card first.');
            }
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Registration state
  const [regNama, setRegNama] = useState('');
  const [regKategori, setRegKategori] = useState('Flexy Packaging');
  const [regStok, setRegStok] = useState(10);

  // Transaction state
  const [tipe, setTipe] = useState('IN');
  const [jumlah, setJumlah] = useState(1);
  const [keterangan, setKeterangan] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const verifyOperatorUid = async (uid) => {
    try {
      const cleanUid = String(uid).trim();
      const docRef = doc(db, 'operator', cleanUid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const opData = docSnap.data();
        setAuthorizedOperator({ nfc_uid: cleanUid, ...opData });
        setOperatorStatus(`✅ Authorized: ${opData.nama_operator} (${opData.role || 'Warehouse Staff'})`);
      } else {
        alert(`❌ Card UID "${cleanUid}" is not registered as a valid Operator. Please register it in Master Data -> Operators.`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to verify operator card.');
    }
  };

  const startOperatorScan = async () => {
    if (!('NDEFReader' in window)) {
      const manual = prompt('Enter Operator ID UID manually:');
      if (manual) verifyOperatorUid(manual.trim());
      return;
    }

    try {
      setOperatorScanning(true);
      setOperatorStatus('Waiting for Operator ID Card...');
      const ndef = new NDEFReader();
      await ndef.scan();

      ndef.addEventListener('reading', ({ serialNumber, message }) => {
        setOperatorScanning(false);
        let uid = serialNumber;
        if (message && message.records && message.records.length > 0) {
          const record = message.records[0];
          if (record.recordType === 'text') {
            const td = new TextDecoder(record.encoding || 'utf-8');
            uid = td.decode(record.data);
          }
        }
        verifyOperatorUid(uid || serialNumber);
      }, { once: true });
    } catch (err) {
      setOperatorScanning(false);
      setOperatorStatus(`Error: ${err.message}`);
    }
  };

  const handleSimulateOperator = () => {
    const mockUid = prompt('Enter Registered Operator UID:', 'OP-001');
    if (mockUid) verifyOperatorUid(mockUid.trim());
  };

  const handleScannedUid = async (uid) => {
    if (!authorizedOperatorRef.current) {
      alert('⚠️ Otorisasi Operator Diperlukan! Silakan scan Kartu ID Operator/Staff terlebih dahulu.');
      return;
    }

    setScannedUid(uid);
    setStatusMsg('');
    try {
      const response = await fetch(`/api/barang/${encodeURIComponent(uid)}`);
      if (response.ok) {
        const data = await response.json();
        setFoundItem(data);
        setIsNotFound(false);
      } else if (response.status === 404) {
        setFoundItem(null);
        setIsNotFound(true);
        setRegNama(`Box / Item (${uid})`);
      } else {
        throw new Error('Server error');
      }
    } catch (err) {
      console.error(err);
      setStatusMsg('Failed to connect to backend API.');
    }
  };

  const startNfcScan = async () => {
    if (!authorizedOperatorRef.current) {
      alert('⚠️ Silakan scan Kartu ID Operator untuk otorisasi terlebih dahulu sebelum melakukan scan barang!');
      return;
    }

    if (!('NDEFReader' in window)) {
      alert('Web NFC API is not supported in this browser. Use Google Chrome on Android, or use "Simulate UID" / "Manual Search".');
      const manualPrompt = prompt('Enter NFC UID manually:');
      if (manualPrompt) handleScannedUid(manualPrompt.trim());
      return;
    }

    try {
      setScanning(true);
      setScanStatus('Waiting for NFC Tag...');
      const ndef = new NDEFReader();
      await ndef.scan();

      ndef.addEventListener('reading', ({ serialNumber, message }) => {
        setScanning(false);
        setScanStatus('Tag Successfully Scanned!');
        let uid = serialNumber;
        if (message && message.records && message.records.length > 0) {
          const record = message.records[0];
          if (record.recordType === 'text') {
            const textDecoder = new TextDecoder(record.encoding || 'utf-8');
            uid = textDecoder.decode(record.data);
          }
        }
        handleScannedUid(uid || serialNumber);
      });

      ndef.addEventListener('readingerror', () => {
        setScanning(false);
        setScanStatus('Failed to Scan NFC. Try again.');
      });
    } catch (error) {
      setScanning(false);
      setScanStatus(`Error: ${error.message}`);
    }
  };

  const handleSimulate = () => {
    if (!authorizedOperatorRef.current) {
      alert('⚠️ Silakan scan Kartu ID Operator untuk otorisasi terlebih dahulu!');
      return;
    }
    const sampleUids = ['BARANG-001', 'BARANG-002', 'BOX-FLEX-99'];
    const randomUid = sampleUids[Math.floor(Math.random() * sampleUids.length)];
    handleScannedUid(randomUid);
  };

  const handleManualSearch = () => {
    if (!authorizedOperatorRef.current) {
      alert('⚠️ Silakan scan Kartu ID Operator untuk otorisasi terlebih dahulu!');
      return;
    }
    const uid = manualUid.trim();
    if (uid) {
      handleScannedUid(uid);
      setManualUid('');
    } else {
      alert('Please enter an NFC UID first');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!authorizedOperatorRef.current) {
      alert('⚠️ Otorisasi Operator Diperlukan!');
      return;
    }
    if (!scannedUid || !regNama) {
      alert('UID and Item Name are required!');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/barang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nfc_uid: scannedUid,
          nama_barang: regNama,
          kategori: regKategori,
          stok: Number(regStok),
          warehouse_user: authorizedOperatorRef.current.nama_operator
        })
      });
      const result = await res.json();
      setLoading(false);
      if (res.ok) {
        setStatusMsg('Successfully registered new item!');
        handleScannedUid(scannedUid);
      } else {
        alert(result.error || 'Failed to register item');
      }
    } catch (err) {
      setLoading(false);
      alert('Network error occurred.');
    }
  };

  const handleTransactionSubmit = async (e) => {
    e.preventDefault();
    if (!authorizedOperatorRef.current) {
      alert('⚠️ Otorisasi Operator Diperlukan! Silakan scan Kartu ID Operator terlebih dahulu.');
      return;
    }
    if (!scannedUid || isNaN(jumlah)) {
      alert('Incomplete transaction data.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/transaksi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nfc_uid: scannedUid,
          tipe,
          jumlah: Number(jumlah),
          keterangan,
          warehouse_user: authorizedOperatorRef.current.nama_operator
        })
      });
      const result = await res.json();
      setLoading(false);
      if (res.ok) {
        setStatusMsg(`✅ Transaction ${tipe} Successful! New stock: ${result.stokSesudah}`);
        setFoundItem(prev => ({ ...prev, stok: result.stokSesudah }));
        setJumlah(1);
        setKeterangan('');
      } else {
        setStatusMsg(`❌ Failed: ${result.error}`);
      }
    } catch (err) {
      setLoading(false);
      setStatusMsg('Network error while saving transaction.');
    }
  };

  return (
    <div className="w-full space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900 tracking-tight">NFC Tag Scan & Transaction Form</h1>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Web NFC Active
        </span>
      </div>

      {/* Operator Authorization Banner */}
      <div className={`p-5 rounded-2xl border transition-all ${
        authorizedOperator
          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
          : 'bg-amber-50 border-amber-200 text-amber-900'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold shadow-xs ${
              authorizedOperator ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white animate-pulse'
            }`}>
              {authorizedOperator ? <ShieldCheck size={24} /> : <Users size={24} />}
            </div>
            <div>
              <h3 className="text-sm font-bold">
                {authorizedOperator ? `Authorized Operator: ${authorizedOperator.nama_operator}` : '⚠️ Operator Authorization Required'}
              </h3>
              <p className="text-xs mt-0.5 opacity-90">
                {authorizedOperator
                  ? `Role: ${authorizedOperator.role || 'Staff Gudang'} | Card UID: ${authorizedOperator.nfc_uid} — Ready for Scan In/Out`
                  : 'Please tap your staff ID card on the Arduino RC522 reader to authorize.'}
              </p>
            </div>
          </div>

          <div>
            {authorizedOperator ? (
              <button
                onClick={() => setAuthorizedOperator(null)}
                className="bg-white hover:bg-stone-50 text-stone-700 font-semibold px-4 py-2 rounded-xl text-xs border border-stone-200 shadow-2xs transition cursor-pointer"
              >
                Switch / Lock Operator
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={startOperatorScan}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2 rounded-xl text-xs shadow-sm transition cursor-pointer"
                >
                  {operatorScanning ? 'Scanning ID Card...' : 'Scan Operator ID Card'}
                </button>
                <button
                  onClick={handleSimulateOperator}
                  className="bg-white hover:bg-stone-50 text-stone-700 font-semibold px-3 py-2 rounded-xl text-xs border border-stone-200 shadow-2xs transition cursor-pointer"
                >
                  Simulate ID
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: NFC Scanner */}
        <div className={`bg-white rounded-2xl border border-stone-200/80 p-6 shadow-2xs space-y-4 ${!authorizedOperator ? 'opacity-50 pointer-events-none' : ''}`}>
          <h3 className="text-sm font-bold text-stone-900">1. Scan NFC Tag / Card</h3>
          <p className="text-xs text-stone-500">
            Tap anywhere on the scanner box below to start scanning, then tap your Android smartphone against the NFC tag/card.
          </p>

          <div
            onClick={startNfcScan}
            onTouchEnd={(e) => {
              e.preventDefault();
              startNfcScan();
            }}
            className={`bg-stone-50 rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all select-none ${
              scanning ? 'border-blue-500 bg-blue-50/30' : 'border-stone-300 hover:border-blue-400'
            }`}
          >
            <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                scanning ? 'bg-blue-600 text-white animate-bounce' : 'bg-blue-600 text-white'
              }`}>
                {scanning ? <Radio size={32} className="animate-pulse" /> : <Scan size={32} />}
              </div>
              <h3 className="text-base font-bold text-stone-900">
                {scanning ? 'Waiting for NFC Tag...' : 'Tap Here to Start NFC Scan'}
              </h3>
              <p className="text-xs text-stone-500">{scanStatus}</p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleSimulate}
              onTouchEnd={(e) => { e.preventDefault(); handleSimulate(); }}
              className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs py-2 px-3 rounded-xl transition cursor-pointer active:scale-95 select-none"
            >
              <Cpu size={14} className="inline mr-1" /> Simulate UID
            </button>
          </div>

          <div className="pt-2 border-t border-stone-100">
            <label className="block text-xs font-semibold text-stone-600 mb-1">Or Enter UID Manually:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualUid}
                onChange={(e) => setManualUid(e.target.value)}
                placeholder="e.g. BARANG-001"
                className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none"
              />
              <button
                type="button"
                onClick={handleManualSearch}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-blue-700 transition cursor-pointer"
              >
                Search
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Item Details & Transaction Form */}
        <div className={`bg-white rounded-2xl border border-stone-200/80 p-6 shadow-2xs space-y-4 ${(!scannedUid || !authorizedOperator) ? 'opacity-60 pointer-events-none' : ''}`}>
          <h3 className="text-sm font-bold text-stone-900">2. Item Details & Transaction</h3>

          {!scannedUid ? (
            <div className="text-center py-12 text-xs text-stone-400">
              Please scan or search an NFC tag first to view item details.
            </div>
          ) : (
            <div>
              {foundItem ? (
                <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl mb-4 space-y-1">
                  <p className="text-[10px] font-bold text-blue-600 uppercase">ITEM FOUND</p>
                  <h4 className="text-sm font-bold text-stone-900">{foundItem.nama_barang}</h4>
                  <p className="text-xs text-stone-500">Category: {foundItem.kategori || 'General'} | Current Stock: <strong className="text-blue-600">{foundItem.stok}</strong></p>
                  <p className="text-[10px] text-stone-400">UID: <code>{foundItem.nfc_uid}</code></p>
                </div>
              ) : isNotFound ? (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-4 space-y-3">
                  <p className="text-xs font-bold text-amber-800">NFC TAG NOT REGISTERED</p>
                  <p className="text-xs text-stone-600">This NFC UID ({scannedUid}) is not in the database. Please register it as a new item below:</p>

                  <form onSubmit={handleRegister} className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">Item / Box Name:</label>
                      <input
                        type="text"
                        value={regNama}
                        onChange={(e) => setRegNama(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded-lg p-2 text-xs outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">Category:</label>
                      <input
                        type="text"
                        value={regKategori}
                        onChange={(e) => setRegKategori(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded-lg p-2 text-xs outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-xl text-xs transition cursor-pointer"
                    >
                      {loading ? <Loader2 size={14} className="animate-spin inline" /> : 'Register New Item to Database'}
                    </button>
                  </form>
                </div>
              ) : null}

              {foundItem && (
                <form onSubmit={handleTransactionSubmit} className="space-y-4 pt-2 border-t border-stone-100">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTipe('IN')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                        tipe === 'IN' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      Stock IN (+)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipe('OUT')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                        tipe === 'OUT' ? 'bg-amber-600 text-white shadow-xs' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      Stock OUT (-)
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Quantity:</label>
                    <input
                      type="number"
                      min="1"
                      value={jumlah}
                      onChange={(e) => setJumlah(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none font-bold text-stone-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Note / Description (Optional):</label>
                    <input
                      type="text"
                      value={keterangan}
                      onChange={(e) => setKeterangan(e.target.value)}
                      placeholder="e.g. Received from Supplier / Shipped to Project"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none text-stone-900"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 size={14} className="animate-spin" />}
                    Confirm Transaction ({tipe})
                  </button>
                </form>
              )}

              {statusMsg && (
                <div className="mt-4 p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-800">
                  {statusMsg}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

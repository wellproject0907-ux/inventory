'use client';

import { useState } from 'react';
import { Scan, X, Loader2, Cpu } from 'lucide-react';
import { addInventoryItem } from '@/services/firebase/inventoryService';
import { Capacitor } from '@capacitor/core';
import { Nfc } from '@capgo/capacitor-nfc';
import styles from './NfcAddItemModal.module.css';

export default function NfcAddItemModal({ isOpen, onClose }) {
  const [nfcUid, setNfcUid] = useState('');
  const [namaBarang, setNamaBarang] = useState('');
  const [stok, setStok] = useState(1);
  const [kategori, setKategori] = useState('Electronics');
  const [lokasi, setLokasi] = useState('Warehouse A');
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleScanNfc = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        setScanning(true);
        setScanStatus('Tempelkan HP ke NTAG / NFC...');

        await Nfc.startScanning();

        Nfc.addListener('nfcTag', (event) => {
          const tag = event.tag;
          const uidBytes = tag.id || [];
          const uid = uidBytes.length > 0
            ? uidBytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':')
            : 'NTAG-DETECTED';
          setNfcUid(uid);
          setScanning(false);
          setScanStatus(`NFC Terdeteksi! UID: ${uid}`);
          Nfc.stopScanning().catch(() => {});
        });
      } catch (err) {
        setScanning(false);
        setScanStatus(`Error NFC Native: ${err.message}. Gunakan simulasi.`);
      }
      return;
    }

    if (!('NDEFReader' in window)) {
      setScanStatus('Web NFC tidak didukung di browser ini. Gunakan simulasi di bawah.');
      return;
    }

    try {
      setScanning(true);
      setScanStatus('Tempelkan HP ke kartu NTAG / NFC...');
      const ndef = new NDEFReader();
      await ndef.scan();

      ndef.onreading = (event) => {
        const uid = event.serialNumber;
        setNfcUid(uid);
        setScanning(false);
        setScanStatus(`NFC Terdeteksi! UID: ${uid}`);
      };

      ndef.onreadingerror = () => {
        setScanning(false);
        setScanStatus('Gagal membaca tag NFC. Gunakan tombol simulasi jika perlu.');
      };
    } catch (err) {
      setScanning(false);
      setScanStatus(`Error NFC: ${err.message}. Gunakan simulasi di bawah.`);
    }
  };

  const handleSimulateScan = () => {
    const mockUid = "04:NTAG:" + Math.floor(Math.random() * 899999 + 100000);
    setNfcUid(mockUid);
    setScanning(false);
    setScanStatus(`[Simulasi NTAG] Terdeteksi! UID: ${mockUid}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nfcUid) {
      alert('Silakan scan kartu NTAG / NFC terlebih dahulu atau gunakan simulasi!');
      return;
    }

    setLoading(true);
    const result = await addInventoryItem({
      nfc_uid: nfcUid,
      nama_barang: namaBarang,
      stok: Number(stok),
      kategori,
      lokasi
    });

    setLoading(false);
    if (result.success) {
      alert('Barang berhasil ditambahkan ke inventaris!');
      onClose();
      setNfcUid('');
      setNamaBarang('');
      setStok(1);
      setScanStatus('');
    } else {
      alert(`Gagal menyimpan: ${result.error}`);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>Tambah Barang via NTAG NFC</h3>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.scanSection}>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleScanNfc}
                onTouchEnd={(e) => { e.preventDefault(); handleScanNfc(); }}
                className={`${styles.scanBtn} cursor-pointer active:scale-95 select-none`}
              >
                <Scan size={16} /> {scanning ? 'Scanning...' : 'Scan NTAG NFC'}
              </button>
              <button
                type="button"
                onClick={handleSimulateScan}
                onTouchEnd={(e) => { e.preventDefault(); handleSimulateScan(); }}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 select-none"
                title="Simulasi scan untuk testing"
              >
                <Cpu size={14} /> Simulasi NTAG
              </button>
            </div>
            <p className={styles.scanStatus}>
              {scanStatus || (nfcUid ? `UID Terdaftar: ${nfcUid}` : 'Belum ada kartu yang dipindai')}
            </p>
          </div>

          <div>
            <label className={styles.label}>UID NTAG / NFC</label>
            <input
              type="text"
              required
              value={nfcUid}
              onChange={(e) => setNfcUid(e.target.value)}
              placeholder="Otomatis terisi saat scan atau simulasi"
              className={styles.input}
            />
          </div>

          <div>
            <label className={styles.label}>Nama Barang</label>
            <input
              type="text"
              required
              value={namaBarang}
              onChange={(e) => setNamaBarang(e.target.value)}
              placeholder="Contoh: Kabel Roll 10 Meter"
              className={styles.input}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={styles.label}>Stok Awal</label>
              <input
                type="number"
                min="0"
                required
                value={stok}
                onChange={(e) => setStok(e.target.value)}
                className={styles.input}
              />
            </div>
            <div>
              <label className={styles.label}>Kategori</label>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
                className={styles.input}
              >
                <option value="Electronics">Electronics</option>
                <option value="Apparel">Apparel</option>
                <option value="Accessories">Accessories</option>
                <option value="General">General</option>
              </select>
            </div>
          </div>

          <div>
            <label className={styles.label}>Lokasi Gudang</label>
            <select
              value={lokasi}
              onChange={(e) => setLokasi(e.target.value)}
              className={styles.input}
            >
              <option value="Warehouse A">Warehouse A</option>
              <option value="Warehouse B">Warehouse B</option>
              <option value="Warehouse C">Warehouse C</option>
              <option value="Warehouse D">Warehouse D</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`${styles.submitBtn} cursor-pointer active:scale-95 select-none`}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Simpan Barang Baru'}
          </button>
        </form>
      </div>
    </div>
  );
}

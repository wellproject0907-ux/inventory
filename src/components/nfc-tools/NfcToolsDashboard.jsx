'use client';

import { useState } from 'react';
import {
  Wrench,
  Scan,
  Radio,
  Cpu,
  FileText,
  Link2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  History,
  Edit3,
  Layers,
  Copy,
  Check
} from 'lucide-react';

export default function NfcToolsDashboard() {
  const [activeTab, setActiveTab] = useState('read'); // 'read' | 'write' | 'history'

  // Read state
  const [scanning, setScanning] = useState(false);
  const [readStatus, setReadStatus] = useState('Ready to scan NFC tags or NTAGs');
  const [tagData, setTagData] = useState(null);

  // Write state
  const [writing, setWriting] = useState(false);
  const [writeStatus, setWriteStatus] = useState('Ready to write NDEF records');
  const [writeType, setWriteType] = useState('text'); // 'text' | 'url'
  const [writePayload, setWritePayload] = useState('');

  // History state
  const [history, setHistory] = useState([]);
  const [copiedUid, setCopiedUid] = useState(null);

  // Read NFC Handler
  const handleStartRead = async () => {
    if (!('NDEFReader' in window)) {
      setReadStatus('Web NFC tidak didukung di browser ini. Gunakan tombol simulasi di bawah.');
      return;
    }

    try {
      setScanning(true);
      setReadStatus('Tempelkan kartu NFC / NTAG ke perangkat...');
      const ndef = new NDEFReader();
      await ndef.scan();

      ndef.onreading = (event) => {
        const { serialNumber, message } = event;
        const timestamp = new Date().toLocaleTimeString();

        let recordsInfo = [];
        if (message && message.records) {
          recordsInfo = message.records.map((rec, index) => {
            const decoder = new TextDecoder(rec.encoding || 'utf-8');
            return {
              index,
              recordType: rec.recordType,
              mediaType: rec.mediaType || 'N/A',
              data: decoder.decode(rec.data)
            };
          });
        }

        const tagInfo = {
          uid: serialNumber,
          records: recordsInfo,
          timestamp,
          type: 'Physical Scan'
        };

        setTagData(tagInfo);
        setScanning(false);
        setReadStatus(`Berhasil membaca tag NFC! UID: ${serialNumber}`);

        setHistory(prev => [tagInfo, ...prev.slice(0, 19)]);
      };

      ndef.onreadingerror = () => {
        setScanning(false);
        setReadStatus('Gagal membaca tag NFC. Silakan coba lagi.');
      };
    } catch (err) {
      setScanning(false);
      setReadStatus(`Error NFC: ${err.message}`);
    }
  };

  const handleSimulateRead = () => {
    const mockUids = ['04:A1:B2:C3:D4:E5:80', '04:F8:E7:D6:C5:B4:90', '04:11:22:33:44:55:66'];
    const randomUid = mockUids[Math.floor(Math.random() * mockUids.length)];
    const timestamp = new Date().toLocaleTimeString();

    const tagInfo = {
      uid: randomUid,
      records: [
        { index: 0, recordType: 'text', mediaType: 'text/plain', data: `NTAG-ITEM-${Math.floor(Math.random() * 899 + 100)}` }
      ],
      timestamp,
      type: 'Simulation'
    };

    setTagData(tagInfo);
    setReadStatus(`[Simulasi] Berhasil memindai UID: ${randomUid}`);
    setHistory(prev => [tagInfo, ...prev.slice(0, 19)]);
  };

  // Write NFC Handler
  const handleStartWrite = async (e) => {
    e.preventDefault();
    if (!writePayload.trim()) {
      alert('Masukkan payload data yang ingin ditulis!');
      return;
    }

    if (!('NDEFReader' in window)) {
      setWriteStatus('Web NFC tidak didukung di browser ini.');
      return;
    }

    try {
      setWriting(true);
      setWriteStatus('Tempelkan kartu NFC / NTAG yang ingin ditulis...');
      const ndef = new NDEFWriter();

      const record = writeType === 'url'
        ? { recordType: 'url', data: writePayload }
        : { recordType: 'text', data: writePayload };

      await ndef.write({ records: [record] });

      setWriting(false);
      setWriteStatus(`Berhasil menulis data ke tag NFC! (${writeType.toUpperCase()})`);

      const timestamp = new Date().toLocaleTimeString();
      setHistory(prev => [{
        uid: 'Written Tag',
        records: [{ index: 0, recordType: writeType, mediaType: writeType === 'url' ? 'text/html' : 'text/plain', data: writePayload }],
        timestamp,
        type: 'Write Operation'
      }, ...prev]);

    } catch (err) {
      setWriting(false);
      setWriteStatus(`Gagal menulis: ${err.message}`);
    }
  };

  const handleSimulateWrite = () => {
    if (!writePayload.trim()) {
      alert('Masukkan payload data yang ingin ditulis!');
      return;
    }
    const timestamp = new Date().toLocaleTimeString();
    setWriteStatus(`[Simulasi] Berhasil menulis "${writePayload}" ke tag NTAG virtual!`);
    setHistory(prev => [{
      uid: 'SIM-TAG-' + Math.floor(Math.random() * 8999 + 1000),
      records: [{ index: 0, recordType: writeType, mediaType: writeType === 'url' ? 'text/html' : 'text/plain', data: writePayload }],
      timestamp,
      type: 'Simulated Write'
    }, ...prev]);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedUid(text);
    setTimeout(() => setCopiedUid(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-blue-600 font-semibold text-xs uppercase tracking-wider mb-1">
            <Wrench size={16} /> NFC Developer & Utility Tools
          </div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">NFC Toolset & Diagnostics</h1>
          <p className="text-stone-500 text-sm mt-0.5">
            Baca, tulis NDEF records, format tag NTAG, dan uji coba interaksi NFC dari browser.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-stone-100 p-1 rounded-xl self-start md:self-auto">
          <button
            onClick={() => setActiveTab('read')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'read' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Scan size={14} /> Read / Inspect
          </button>
          <button
            onClick={() => setActiveTab('write')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'write' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Edit3 size={14} /> Write Tag
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <History size={14} /> Log ({history.length})
          </button>
        </div>
      </div>

      {/* TAB 1: READ & INSPECT */}
      {activeTab === 'read' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white p-6 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2 mb-2">
                <Radio size={16} className="text-blue-600 animate-pulse" /> Live NFC Reader
              </h2>
              <p className="text-xs text-stone-500 mb-6 leading-relaxed">
                Gunakan perangkat ber-NFC (Chrome Android) untuk mendekatkan kartu NTAG atau tag NFC ke bagian belakang HP.
              </p>

              <div className="space-y-3">
                <button
                  onClick={handleStartRead}
                  disabled={scanning}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 shadow-xs disabled:opacity-50"
                >
                  {scanning ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Scan size={16} />}
                  {scanning ? 'Mendengarkan Tag NFC...' : 'Mulai Scan Tag'}
                </button>

                <button
                  onClick={handleSimulateRead}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 shadow-xs"
                >
                  <Cpu size={16} /> Simulasi Scan Tag
                </button>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-stone-100">
              <p className="text-[11px] font-medium text-stone-400">Status Reader:</p>
              <p className="text-xs font-semibold text-stone-700 mt-1 bg-stone-50 p-2.5 rounded-lg border border-stone-200/60">
                {readStatus}
              </p>
            </div>
          </div>

          <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-stone-200 shadow-xs flex flex-col">
            <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2 mb-4">
              <Layers size={16} className="text-stone-700" /> Hasil Inspeksi Tag NFC / NTAG
            </h2>

            {tagData ? (
              <div className="space-y-4 flex-1">
                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">UID Tag / Serial Number</span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-md">{tagData.type}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-stone-900 text-sm sm:text-base">{tagData.uid}</span>
                    <button
                      onClick={() => copyToClipboard(tagData.uid)}
                      className="text-stone-500 hover:text-stone-900 p-1.5 rounded-lg hover:bg-stone-200/60 transition cursor-pointer flex items-center gap-1 text-xs font-medium"
                      title="Salin UID"
                    >
                      {copiedUid === tagData.uid ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      <span>{copiedUid === tagData.uid ? 'Tersalin' : 'Salin'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-stone-400 mt-1">Dipindai pukul {tagData.timestamp}</p>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-stone-700 mb-2 uppercase tracking-wider">NDEF Records ({tagData.records.length})</h3>
                  {tagData.records.length > 0 ? (
                    <div className="space-y-2">
                      {tagData.records.map((rec) => (
                        <div key={rec.index} className="bg-white border border-stone-200 p-3.5 rounded-xl shadow-2xs space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-blue-600 flex items-center gap-1">
                              {rec.recordType === 'url' ? <Link size={13} /> : <FileText size={13} />}
                              Record #{rec.index + 1} ({rec.recordType})
                            </span>
                            <span className="text-[10px] text-stone-400">Type: {rec.mediaType}</span>
                          </div>
                          <p className="text-xs font-mono bg-stone-50 p-2 rounded-lg text-stone-800 break-all border border-stone-100">
                            {rec.data}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-stone-50 rounded-xl border border-dashed border-stone-200 text-stone-400 text-xs">
                      Tidak ada NDEF record ditemukan pada tag ini (hanya UID mentah).
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-12 bg-stone-50 rounded-xl border border-dashed border-stone-200">
                <Scan size={36} className="text-stone-300 mb-3 animate-pulse" />
                <p className="text-sm font-semibold text-stone-700">Belum ada tag yang dipindai</p>
                <p className="text-xs text-stone-400 mt-1 max-w-xs">
                  Klik tombol "Mulai Scan Tag" atau "Simulasi Scan Tag" untuk melihat detail data tag NFC.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: WRITE TAG */}
      {activeTab === 'write' && (
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs max-w-2xl mx-auto">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2 mb-1">
            <Edit3 size={16} className="text-blue-600" /> Tulis Data ke Kartu NFC / NTAG
          </h2>
          <p className="text-xs text-stone-500 mb-6">
            Tulis NDEF record (Teks atau URL) ke dalam chip NTAG yang mendukung Web NFC.
          </p>

          <form onSubmit={handleStartWrite} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">Tipe Record NDEF</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setWriteType('text')}
                  className={`py-2.5 px-4 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center justify-center gap-2 ${
                    writeType === 'text'
                      ? 'border-blue-600 bg-blue-50/50 text-blue-700 shadow-2xs'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <FileText size={14} /> Text Record
                </button>
                <button
                  type="button"
                  onClick={() => setWriteType('url')}
                  className={`py-2.5 px-4 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center justify-center gap-2 ${
                    writeType === 'url'
                      ? 'border-blue-600 bg-blue-50/50 text-blue-700 shadow-2xs'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <Link2 size={14} /> URL Record
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                {writeType === 'url' ? 'Target URL (contoh: https://inventory-app.com/item/001)' : 'Konten Teks (contoh: BARANG-GUDANG-A1)'}
              </label>
              <input
                type={writeType === 'url' ? 'url' : 'text'}
                required
                value={writePayload}
                onChange={(e) => setWritePayload(e.target.value)}
                placeholder={writeType === 'url' ? 'https://...' : 'Masukkan teks payload...'}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>

            <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 text-xs text-stone-600 space-y-1">
              <span className="font-bold text-stone-800">Status Penulisan:</span>
              <p className="font-medium text-blue-700">{writeStatus}</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={writing}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 shadow-xs disabled:opacity-50"
              >
                {writing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Edit3 size={16} />}
                {writing ? 'Menulis ke Tag...' : 'Tulis ke Kartu NFC'}
              </button>

              <button
                type="button"
                onClick={handleSimulateWrite}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 shadow-xs"
                title="Simulasi penulisan untuk testing"
              >
                <Cpu size={16} /> Simulasi Write
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: HISTORY LOG */}
      {activeTab === 'history' && (
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <History size={16} className="text-stone-700" /> Riwayat Aktivitas NFC (Sesi Ini)
            </h2>
            {history.length > 0 && (
              <button
                onClick={() => setHistory([])}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
              >
                <Trash2 size={14} /> Bersihkan Log
              </button>
            )}
          </div>

          {history.length > 0 ? (
            <div className="space-y-3">
              {history.map((item, idx) => (
                <div key={idx} className="bg-stone-50 border border-stone-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] bg-stone-200 text-stone-700 font-semibold px-2 py-0.5 rounded-md">{item.type}</span>
                      <span className="text-xs text-stone-400">{item.timestamp}</span>
                    </div>
                    <p className="font-mono font-bold text-stone-900 text-xs sm:text-sm">UID: {item.uid}</p>
                    {item.records && item.records.length > 0 && (
                      <p className="text-xs text-stone-600 mt-1">
                        Record ({item.records[0].recordType}): <span className="font-mono font-medium">{item.records[0].data}</span>
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => copyToClipboard(item.uid)}
                    className="self-start sm:self-center bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1"
                  >
                    <Copy size={13} /> Salin UID
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-stone-50 rounded-xl border border-dashed border-stone-200 text-stone-400 text-xs">
              Belum ada riwayat aktivitas NFC pada sesi ini.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

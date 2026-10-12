import { NextResponse } from 'next/server';
import { db } from '@/services/firebase/config';
import { collection, doc, setDoc, deleteDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'File Excel (.xlsx/.xls) wajib diunggah.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (!rows || rows.length < 2) {
      return NextResponse.json({ error: 'File Excel kosong atau tidak memiliki baris data.' }, { status: 400 });
    }

    // Bersihkan cache data lama di Firestore
    const oldSnap = await getDocs(collection(db, 'bahan'));
    const deletePromises = oldSnap.docs.map(d => deleteDoc(doc(db, 'bahan', d.id)));
    await Promise.all(deletePromises);

    let count = 0;
    const uniqueSuppliers = new Set();

    // Loop mulai dari baris ke-1 (setelah header)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !Array.isArray(row) || row.length === 0) continue;

      // Urutan kolom pasti sesuai permintaan:
      // Kolom 0 = SKU (contoh: MAT-ECO-STC-ULCLR-DURATAC-1,52X50)
      // Kolom 1 = Nama Bahan
      // Kolom 2 = Stok Maksimum
      // Kolom 3 = Satuan
      // Kolom 4 = Supplier
      const sku = String(row[0] || '').trim();
      const namaBahan = String(row[1] || sku).trim();
      const stokMaksimum = Number(row[2] || 0);
      const satuan = String(row[3] || 'Pcs').trim();
      const supplier = String(row[4] || 'General Supplier').trim();

      if (!sku && !namaBahan) continue;

      const docId = String(sku || namaBahan).toLowerCase().replace(/[^a-z0-9]/g, '_');
      const docRef = doc(db, 'bahan', docId);

      const payload = {
        sku: sku || `SKU-${Math.random().toString(36).substring(2, 7)}`,
        nama_bahan: namaBahan || sku,
        stok_maksimum: isNaN(stokMaksimum) ? 0 : stokMaksimum,
        satuan: satuan || 'Pcs',
        supplier: supplier || 'General Supplier',
        updated_at: serverTimestamp()
      };

      await setDoc(docRef, payload);

      if (payload.supplier && payload.supplier !== 'General Supplier' && payload.supplier !== '-') {
        uniqueSuppliers.add(payload.supplier);
      }
      count++;
    }

    // Simpan daftar supplier unik
    for (const supName of uniqueSuppliers) {
      const supId = String(supName).toLowerCase().replace(/[^a-z0-9]/g, '_');
      await setDoc(doc(db, 'suplier', supId), {
        nama_suplier: supName,
        updated_at: serverTimestamp()
      }, { merge: true });
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil mengimpor ${count} data master sesuai urutan kolom Excel.`,
      count
    });

  } catch (error) {
    console.error('Excel upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

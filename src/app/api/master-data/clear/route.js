import { NextResponse } from 'next/server';
import { db } from '@/services/firebase/config';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

export async function POST() {
  try {
    const collectionsToClear = ['barang', 'bahan', 'suplier', 'riwayat_transaksi'];

    for (const colName of collectionsToClear) {
      const snap = await getDocs(collection(db, colName));
      const deletePromises = snap.docs.map(d => deleteDoc(doc(db, colName, d.id)));
      await Promise.all(deletePromises);
    }

    return NextResponse.json({ success: true, message: 'Semua data berhasil dihapus dari database.' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

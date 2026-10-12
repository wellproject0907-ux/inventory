import { NextResponse } from 'next/server';
import { db } from '@/services/firebase/config';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

export async function GET(req, { params }) {
  try {
    const { uid } = await params;
    const q = query(collection(db, 'barang'), where('nfc_uid', '==', uid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json({ error: 'Item not found with this NFC UID' }, { status: 404 });
    }

    const docSnap = snapshot.docs[0];
    return NextResponse.json({ id: docSnap.id, ...docSnap.data() });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { uid } = await params;

    // 1. Delete item from 'barang' collection (by document ID or UID)
    await deleteDoc(doc(db, 'barang', String(uid)));

    // 2. Also delete associated transaction history from 'riwayat_transaksi'
    try {
      const qTx = query(collection(db, 'riwayat_transaksi'), where('nfc_uid', '==', uid));
      const txSnap = await getDocs(qTx);
      const deleteTxPromises = txSnap.docs.map(d => deleteDoc(doc(db, 'riwayat_transaksi', d.id)));
      await Promise.all(deleteTxPromises);
    } catch (e) {
      console.error('Error cleaning up transaction history:', e);
    }

    return NextResponse.json({ success: true, message: 'Item and associated transaction history deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

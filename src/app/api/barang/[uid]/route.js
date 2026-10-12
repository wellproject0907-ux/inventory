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
    await deleteDoc(doc(db, 'barang', String(uid)));
    return NextResponse.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

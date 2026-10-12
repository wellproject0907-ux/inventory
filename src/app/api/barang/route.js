import { NextResponse } from 'next/server';
import { db } from '@/services/firebase/config';
import { collection, getDocs, addDoc, doc, setDoc, getDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';

export async function GET() {
  try {
    const q = query(collection(db, 'barang'), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { nfc_uid, nama_barang, kategori, stok } = body;
    if (!nfc_uid || !nama_barang) {
      return NextResponse.json({ error: 'nfc_uid and nama_barang are required' }, { status: 400 });
    }

    const docRef = doc(db, 'barang', String(nfc_uid));
    const docSnap = await getDoc(docRef);
    const initialStok = stok !== undefined ? parseInt(stok) : 0;

    if (docSnap.exists()) {
      await setDoc(docRef, {
        nama_barang,
        kategori: kategori || 'General',
        updated_at: serverTimestamp()
      }, { merge: true });
      return NextResponse.json({ message: 'Item successfully updated', nfc_uid });
    } else {
      await setDoc(docRef, {
        nfc_uid: String(nfc_uid),
        nama_barang: String(nama_barang),
        kategori: String(kategori || 'General'),
        stok: initialStok,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });

      if (initialStok > 0) {
        await addDoc(collection(db, 'riwayat_transaksi'), {
          nfc_uid: String(nfc_uid),
          tipe: 'IN',
          jumlah: initialStok,
          keterangan: 'Initial stock / Item registration',
          timestamp: serverTimestamp()
        });
      }

      return NextResponse.json({ message: 'New item successfully registered', nfc_uid }, { status: 201 });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

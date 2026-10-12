import { NextResponse } from 'next/server';
import { db } from '@/services/firebase/config';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(req) {
  try {
    const body = await req.json();
    const { nfc_uid, tipe, jumlah, keterangan } = body;

    if (!nfc_uid || !tipe) {
      return NextResponse.json({ error: 'nfc_uid and tipe (IN/OUT) are required' }, { status: 400 });
    }

    const q = query(collection(db, 'barang'), where('nfc_uid', '==', nfc_uid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json({ error: 'Item with this NFC UID is not registered in the system.' }, { status: 400 });
    }

    const itemDoc = snapshot.docs[0];
    const itemRef = doc(db, 'barang', itemDoc.id);
    const currentData = itemDoc.data();
    let currentStok = Number(currentData.stok || 0);
    let newStok = currentStok;

    const qty = jumlah !== undefined ? Number(jumlah) : 1;

    if (tipe === 'IN') {
      newStok += qty;
    } else if (tipe === 'OUT') {
      if (currentStok < qty) {
        return NextResponse.json({ error: 'Insufficient stock for OUT transaction.' }, { status: 400 });
      }
      newStok -= qty;
    } else {
      return NextResponse.json({ error: 'Transaction type must be IN or OUT' }, { status: 400 });
    }

    await updateDoc(itemRef, {
      stok: newStok,
      updated_at: serverTimestamp()
    });

    await addDoc(collection(db, 'riwayat_transaksi'), {
      nfc_uid,
      tipe,
      jumlah: qty,
      keterangan: keterangan || (tipe === 'IN' ? 'Warehouse Stock In' : 'Warehouse Stock Out'),
      timestamp: serverTimestamp()
    });

    return NextResponse.json({
      message: `Transaction ${tipe} successfully recorded`,
      nama_barang: currentData.nama_barang,
      stokSebelum: currentStok,
      stokSesudah: newStok
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

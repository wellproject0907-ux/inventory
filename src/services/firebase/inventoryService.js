import { db } from './config';
import { collection, onSnapshot, query, orderBy, addDoc, getDocs, where, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

// 1. Real-time listener for inventory items from Firestore
export function subscribeToInventory(callback) {
  const q = query(collection(db, 'barang'), orderBy('created_at', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(items);
  }, (error) => {
    console.error("Error fetching inventory: ", error);
    callback([]);
  });
}

// 2. Get item by NFC UID
export async function getItemByNfcUid(nfc_uid) {
  const q = query(collection(db, 'barang'), where('nfc_uid', '==', nfc_uid));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docRef = snapshot.docs[0];
  return { id: docRef.id, ...docRef.data() };
}

// 3. Register new item
export async function registerItem(itemData) {
  const docRef = await addDoc(collection(db, 'barang'), {
    nfc_uid: itemData.nfc_uid,
    nama_barang: itemData.nama_barang,
    kategori: itemData.kategori || 'General',
    stok: Number(itemData.stok || 0),
    lokasi: itemData.lokasi || 'Warehouse A',
    created_at: serverTimestamp()
  });
  return { id: docRef.id, ...itemData };
}

// 4. Record transaction (IN / OUT)
export async function recordTransaction({ nfc_uid, tipe, jumlah, keterangan }) {
  const q = query(collection(db, 'barang'), where('nfc_uid', '==', nfc_uid));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    throw new Error('Item not found in database');
  }

  const itemDoc = snapshot.docs[0];
  const itemData = itemDoc.data();
  let currentStok = Number(itemData.stok || 0);
  let newStok = currentStok;

  if (tipe === 'IN') {
    newStok += Number(jumlah);
  } else if (tipe === 'OUT') {
    if (currentStok < Number(jumlah)) {
      throw new Error('Insufficient stock for OUT transaction');
    }
    newStok -= Number(jumlah);
  }

  // Update stock in Firestore
  await updateDoc(doc(db, 'barang', itemDoc.id), { stok: newStok });

  // Record transaction history
  await addDoc(collection(db, 'riwayat_transaksi'), {
    nfc_uid,
    tipe,
    jumlah: Number(jumlah),
    keterangan: keterangan || '',
    timestamp: serverTimestamp()
  });

  return { stokSebelum: currentStok, stokSesudah: newStok, nama_barang: itemData.nama_barang };
}

// 5. Calculate metrics dynamically from inventory items
export function calculateMetrics(items) {
  let totalProducts = items.length;
  let inStock = 0;
  let lowStock = 0;
  let outOfStock = 0;

  items.forEach(item => {
    const stock = Number(item.stok || 0);
    if (stock === 0) {
      outOfStock++;
    } else if (stock <= 5) {
      lowStock++;
      inStock++;
    } else {
      inStock++;
    }
  });

  return { totalProducts, inStock, lowStock, outOfStock };
}

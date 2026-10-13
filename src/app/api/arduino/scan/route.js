import { NextResponse } from 'next/server';
import { db } from '@/services/firebase/config';
import { doc, getDoc, setDoc, updateDoc, addDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';

export async function POST(req) {
  try {
    const body = await req.json();
    const { uid, sku, nama_barang, kategori, no_sj, no_spk, action, warehouse_user } = body;

    if (!uid) {
      return NextResponse.json({ error: 'UID is required' }, { status: 400 });
    }

    const rawUid = String(uid).trim();
    const cleanUid = rawUid.replace(/\s+/g, '').toUpperCase();

    if (!cleanUid || !/^[0-9A-Fa-f]{4,16}$/.test(cleanUid)) {
      return NextResponse.json({ error: 'Invalid RFID UID format' }, { status: 400 });
    }

    // Always update last_scanned_uid for any physical Arduino reader scan
    try {
      await updateDoc(doc(db, 'system', 'settings'), {
        last_scanned_uid: cleanUid,
        last_scanned_at: serverTimestamp()
      });
    } catch (e) {
      try {
        await setDoc(doc(db, 'system', 'settings'), {
          last_scanned_uid: cleanUid,
          last_scanned_at: serverTimestamp()
        }, { merge: true });
      } catch (err) {}
    }

    // Resolve active operator user
    let opUser = warehouse_user;
    if (!opUser) {
      try {
        const sSnap = await getDoc(doc(db, 'system', 'settings'));
        if (sSnap.exists()) {
          opUser = sSnap.data().active_operator_name;
        }
      } catch (e) {}
    }
    const finalUser = opUser || 'Warehouse Admin';

    // 1. Check if scanned card is an Authorized Operator Card
    const operatorSnap = await getDoc(doc(db, 'operator', cleanUid));
    if (operatorSnap.exists()) {
      const opData = operatorSnap.data();

      // Check if any item is waiting for operator authorization in system settings
      try {
        const settingsSnap = await getDoc(doc(db, 'system', 'settings'));
        if (settingsSnap.exists() && settingsSnap.data().pending_item_uid) {
          const pendingUid = settingsSnap.data().pending_item_uid;
          const docRef = doc(db, 'barang', pendingUid);
          const docSnap = await getDoc(docRef);

          if (!docSnap.exists()) {
            // Create the item now for Scan 1 (Registrasi Barang Masuk)
            const itemData = {
              nfc_uid: pendingUid,
              sku: `SKU-${pendingUid}`,
              nama_barang: `Barang RFID (${pendingUid})`,
              kategori: 'General Supplier',
              no_sj: '',
              no_spk: '',
              stok: 1,
              lifecycle: 'IN',
              is_completed: false,
              needs_naming: true,
              needs_spk: false,
              needs_already_registered_popup: false,
              warehouse_user: opData.nama_operator,
              scan_in_at: serverTimestamp(),
              scan_out_at: null,
              created_at: serverTimestamp(),
              updated_at: serverTimestamp()
            };
            await setDoc(docRef, itemData);
          } else {
            const itemData = docSnap.data();
            const nextState = itemData.lifecycle === 'IN' && itemData.sku && !itemData.needs_naming
              ? { needs_spk: true, warehouse_user: opData.nama_operator }
              : { needs_naming: true, warehouse_user: opData.nama_operator };
            await updateDoc(docRef, nextState);
          }

          // Clear pending item UID & set active operator
          await updateDoc(doc(db, 'system', 'settings'), {
            pending_item_uid: null,
            active_operator_name: opData.nama_operator,
            active_operator_role: opData.role || 'Staff Gudang',
            last_scanned_uid: cleanUid,
            last_scanned_at: serverTimestamp()
          });
        }
      } catch (e) {
        console.error('Error unlocking pending auth item:', e);
      }

      return NextResponse.json({
        success: true,
        action: 'OPERATOR_CARD',
        message: `Operator authorized: ${opData.nama_operator}`,
        operator: { id: cleanUid, ...opData }
      });
    }

    // 2. If it is NOT an operator card, it's an item card. Do NOT create in 'barang' yet! Set pending_item_uid in settings.
    try {
      await updateDoc(doc(db, 'system', 'settings'), {
        pending_item_uid: cleanUid,
        active_operator_name: null, // Clear active operator to force fresh scan
        last_scanned_uid: cleanUid,
        last_scanned_at: serverTimestamp()
      });
    } catch (e) {
      await setDoc(doc(db, 'system', 'settings'), {
        pending_item_uid: cleanUid,
        active_operator_name: null,
        last_scanned_uid: cleanUid,
        last_scanned_at: serverTimestamp()
      }, { merge: true });
    }

    return NextResponse.json({
      success: true,
      action: 'PENDING_OPERATOR_AUTH',
      message: '⚠️ Otorisasi Operator Diperlukan! Silakan scan Kartu ID Operator terlebih dahulu.'
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

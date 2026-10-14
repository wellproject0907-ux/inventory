import { NextResponse } from 'next/server';
import { db } from '@/services/firebase/config';
import { doc, getDoc, setDoc, updateDoc, addDoc, serverTimestamp, collection, getDocs, query, where } from 'firebase/firestore';

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

    // === STRICT OPERATOR CARD CHECK ===
    // If card belongs to an Operator ID Card, authorize operator and REJECT product Scan IN / Scan OUT transactions!
    try {
      const opDocRef = doc(db, 'operator', cleanUid);
      const opDocSnap = await getDoc(opDocRef);
      if (opDocSnap.exists()) {
        const opData = opDocSnap.data();
        const opName = opData.nama_operator || opData.nama || 'Operator';
        const opRole = opData.role || 'Warehouse Staff';

        await updateDoc(doc(db, 'system', 'settings'), {
          active_operator_name: opName,
          active_operator_role: opRole,
          active_operator_uid: cleanUid,
          last_scanned_uid: cleanUid,
          last_scanned_at: serverTimestamp(),
          updated_at: serverTimestamp()
        }).catch(() => {});

        // Clear active scan so no Scan IN / Scan OUT modal opens for operator card!
        await setDoc(doc(db, 'system', 'active_scan'), {
          uid: cleanUid,
          claimed: true,
          needs_naming: false,
          created_at: serverTimestamp()
        }).catch(() => {});

        return NextResponse.json({
          success: true,
          action: 'OPERATOR_AUTHORIZED',
          message: `Operator Authorized: "${opName}". Operator ID cards cannot be registered as product inventory.`,
          operator: opData
        });
      }
    } catch (e) {
      console.error('Operator card check error:', e);
    }

    const finalUser = warehouse_user || 'Test Operator';

    // === Robust Document Lookup by cleanUid ID or nfc_uid field ===
    let docRef = doc(db, 'barang', cleanUid);
    let docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      const q = query(collection(db, 'barang'), where('nfc_uid', '==', cleanUid));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        docSnap = qSnap.docs[0];
        docRef = doc(db, 'barang', docSnap.id);
      }
    }

    let currentMode = 'INVENTORY';
    try {
      const settingsSnap = await getDoc(doc(db, 'system', 'settings'));
      if (settingsSnap.exists()) {
        currentMode = settingsSnap.data().mode || 'INVENTORY';
      }
    } catch (e) {}

    if (action !== 'SAVE_REGISTRATION' && !sku && ((currentMode === 'OPNAME' && (!action || action === 'LOG')) || action === 'AUDIT')) {
      if (!docSnap.exists()) {
        return NextResponse.json({
          success: false,
          action: 'AUDIT_NOT_FOUND',
          message: `Tag UID "${cleanUid}" is not registered in the inventory database (Stock Opname Mode).`
        }, { status: 404 });
      }

      const itemData = docSnap.data();
      return NextResponse.json({
        success: true,
        action: 'AUDIT_FOUND',
        message: 'Item verified in Stock Opname Mode (Read-Only). No stock mutation.',
        item: { id: cleanUid, ...itemData }
      });
    }

    if (action === 'DISMISS_ALREADY_REGISTERED') {
      if (docSnap.exists()) {
        await updateDoc(docRef, { needs_already_registered_popup: false, locked_by_tab: null, updated_at: serverTimestamp() });
      }
      return NextResponse.json({ success: true, message: 'Dismissed' });
    }

    if (action === 'CONFIRM_OUT') {
      if (!docSnap.exists()) {
        return NextResponse.json({ success: false, message: 'Item not found' }, { status: 404 });
      }
      const itemData = docSnap.data();

      if (no_spk === 'CANCELLED') {
        await updateDoc(docRef, { needs_spk: false, locked_by_tab: null, updated_at: serverTimestamp() });
        return NextResponse.json({ success: true, message: 'Outbound scan cancelled' });
      }

      await updateDoc(docRef, {
        stok: 0,
        lifecycle: 'COMPLETED',
        is_completed: true,
        needs_spk: false,
        no_spk: no_spk || 'SPK-DEFAULT',
        warehouse_user: finalUser,
        warehouse_user_out: finalUser,
        scan_out_at: serverTimestamp(),
        locked_by_tab: null,
        updated_at: serverTimestamp()
      });

      await addDoc(collection(db, 'riwayat_transaksi'), {
        nfc_uid: cleanUid,
        sku: itemData.sku || '',
        nama_barang: itemData.nama_barang || '',
        tipe: 'OUT',
        jumlah: 1,
        warehouse_user: finalUser,
        no_sj: itemData.no_sj || '',
        no_spk: no_spk || 'SPK-DEFAULT',
        keterangan: `Scan 2: Stock OUT (SPK No: ${no_spk || 'N/A'}) - Completed`,
        timestamp: serverTimestamp()
      });

      return NextResponse.json({
        success: true,
        action: 'OUT',
        message: 'Outbound stock confirmation successful & SPK saved',
        item: { id: cleanUid, ...itemData, stok: 0, lifecycle: 'COMPLETED' }
      });
    }

    let itemName = nama_barang || `RFID Item (${cleanUid})`;
    let itemKategori = kategori || 'General Supplier';
    let itemSku = sku || `SKU-${cleanUid}`;
    let itemNoSj = no_sj || '';

    if (!docSnap.exists()) {
      if (!sku) {
        await setDoc(doc(db, 'system', 'active_scan'), {
          uid: cleanUid,
          needs_naming: true,
          claimed: false,
          created_at: serverTimestamp(),
          scan_time: Date.now()
        });

        return NextResponse.json({
          success: true,
          action: 'PENDING_REGISTRATION',
          message: 'New tag scanned. Pending registration on website.',
          uid: cleanUid,
          item: {
            nama_barang: `Barang Baru (${cleanUid})`,
            stok: 0
          }
        });
      }

      const itemData = {
        nfc_uid: cleanUid,
        sku: itemSku,
        nama_barang: itemName,
        kategori: itemKategori,
        no_sj: itemNoSj,
        no_spk: '',
        stok: 1,
        lifecycle: 'IN',
        is_completed: false,
        needs_operator_auth: false,
        needs_naming: false,
        needs_spk: false,
        needs_already_registered_popup: false,
        warehouse_user: finalUser,
        warehouse_user_in: finalUser,
        warehouse_user_out: null,
        scan_in_at: serverTimestamp(),
        scan_out_at: null,
        locked_by_tab: null,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };

      await setDoc(docRef, itemData);

      await setDoc(doc(db, 'system', 'active_scan'), {
        uid: cleanUid,
        claimed: true,
        needs_naming: false,
        created_at: serverTimestamp()
      });

      await addDoc(collection(db, 'riwayat_transaksi'), {
        nfc_uid: cleanUid,
        sku: itemSku,
        nama_barang: itemName,
        tipe: 'IN',
        jumlah: 1,
        warehouse_user: finalUser,
        no_sj: itemNoSj,
        keterangan: `Scan 1: Stok IN (No. SJ: ${itemNoSj || 'N/A'})`,
        timestamp: serverTimestamp()
      });

      return NextResponse.json({
        success: true,
        action: 'IN',
        needs_naming: false,
        message: 'Scan 1 Successful: Inbound stock & Delivery Order saved',
        item: { id: cleanUid, sku: itemSku, nama_barang: itemName, stok: 1, lifecycle: 'IN' }
      });

    } else {
      const itemData = docSnap.data();

      if (sku || nama_barang) {
        await updateDoc(docRef, {
          sku: sku || itemData.sku,
          nama_barang: nama_barang || itemData.nama_barang,
          kategori: kategori || itemData.kategori || 'General Supplier',
          no_sj: no_sj || itemData.no_sj || '',
          warehouse_user: finalUser,
          needs_operator_auth: false,
          needs_naming: false,
          locked_by_tab: null,
          updated_at: serverTimestamp()
        });

        if (no_sj) {
          await addDoc(collection(db, 'riwayat_transaksi'), {
            nfc_uid: cleanUid,
            sku: sku || itemData.sku,
            nama_barang: nama_barang || itemData.nama_barang,
            tipe: 'IN',
            jumlah: 1,
            warehouse_user: finalUser,
            no_sj: no_sj,
            keterangan: `Scan 1 Registered (Delivery Order: ${no_sj})`,
            timestamp: serverTimestamp()
          });
        }

        return NextResponse.json({
          success: true,
          message: 'SKU, Supplier, and Delivery Order details updated successfully',
          item: { id: cleanUid, sku, nama_barang, kategori, no_sj }
        });
      }

      if (itemData.is_completed || itemData.lifecycle === 'COMPLETED' || Number(itemData.stok ?? 0) === 0) {
        return NextResponse.json({
          success: false,
          error: 'NOT_FOUND_IN_WAREHOUSE',
          message: `Item with SKU / UID "${cleanUid}" not found in warehouse!`,
          item: itemData
        }, { status: 404 });
      }

      if (itemData.lifecycle === 'IN' || Number(itemData.stok ?? 0) > 0) {
        await updateDoc(docRef, {
          needs_spk: true,
          needs_already_registered_popup: false,
          needs_operator_auth: false,
          locked_by_tab: null,
          updated_at: serverTimestamp(),
          scan_time: Date.now()
        });

        return NextResponse.json({
          success: true,
          action: 'OUT',
          needs_spk: true,
          message: `Scan 2 detected for "${itemData.nama_barang}": Awaiting SPK confirmation`,
          item: itemData
        });
      }

      return NextResponse.json({ success: true, message: 'Tag scanned' });
    }

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

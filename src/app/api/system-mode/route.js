import { NextResponse } from 'next/server';
import { db } from '@/services/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export async function GET(req) {
  try {
    const docSnap = await getDoc(doc(db, 'system', 'settings'));
    const mode = docSnap.exists() ? docSnap.data().mode || 'INVENTORY' : 'INVENTORY';
    return NextResponse.json({ success: true, mode });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { mode } = await req.json();
    if (!mode || !['INVENTORY', 'OPNAME'].includes(mode)) {
      return NextResponse.json({ success: false, error: 'Invalid mode' }, { status: 400 });
    }
    await setDoc(doc(db, 'system', 'settings'), { mode, updated_at: serverTimestamp() }, { merge: true });
    return NextResponse.json({ success: true, mode });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

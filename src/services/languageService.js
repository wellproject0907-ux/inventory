'use client';

import { useState, useEffect } from 'react';

export const translations = {
  en: {
    // Navigation
    dashboard: "Dashboard",
    inventory: "Inventory",
    stockOpname: "Stock Opname",
    inbound: "Inbound",
    outbound: "Outbound",
    masterData: "Master Data",
    settings: "Settings & Roles",
    language: "Language",
    activeTerminal: "Active Terminal",
    rfidHardwareMode: "RFID Hardware Mode",
    connectUsb: "Connect USB RFID",
    usbConnected: "USB RFID Connected",

    // Inbound Page
    inboundHubTitle: "Inbound (Scan In)",
    inboundHubDesc: "All scanned incoming items and registered warehouse inventory.",
    inboundListTitle: "Inbound Items List",
    inboundListDesc: "Scanned and registered incoming items in the warehouse",

    // Outbound Page
    outboundHubTitle: "Outbound (Scan Out)",
    outboundHubDesc: "Monitor and manage all checked-out warehouse items grouped by material with timestamps.",
    outboundListTitle: "Grouped Outbound Materials",
    outboundListDesc: "Checked-out material groups and completed Scan OUT cycles",

    // Inventory Page
    inventoryHubTitle: "Grouped Material Inventory",
    inventoryHubDesc: "View active warehouse stock grouped strictly by material name with accordion breakdown.",

    // Stock Opname Page
    stockOpnameTitle: "Stock Opname & Audit",
    stockOpnameDesc: "Reconcile System Inventory (Qty System) vs Physical RFID Scans (Qty Physical) in real-time.",
    saveReportToFirebase: "Save Audit Report to Firebase",
    exportExcel: "Export Excel (.xlsx)",
    resetScan: "Reset Scan",
    realtimeScanner: "Real-time Physical Audit Scanner",
    auditSessionActive: "Audit Session Active",
    groupedReconciliation: "Grouped Material Reconciliation",
    showingAllMaterials: "Showing All Materials",
    auditedItemsOnly: "Audited Items Only",
    noAuditScans: "No Audit Scans in Current Session",
    noAuditScansDesc: "Please tap RFID cards on the reader to reconcile physical inventory with system records.",
    firebaseAuditHistory: "Firebase Stock Opname Audit Report History",
    auditDate: "Audit Date",
    auditor: "Auditor / Operator",
    summary: "Summary (System vs Scan)",
    auditResult: "Audit Result",

    // Common Table Headers
    materialName: "Material Name",
    materialAndDetails: "Material Name & Details",
    materialAndBaseSku: "Material Name & Base SKU",
    skuAndUid: "SKU & UID",
    supplier: "Supplier",
    sjAndSpk: "SJ & SPK No.",
    operator: "Operator",
    status: "Status",
    action: "Action",
    actions: "Actions",
    qtySystem: "Qty System",
    qtyPhysical: "Qty Physical (Audit)",
    variance: "Variance",
    auditStatus: "Audit Status",
    totalQtyOut: "Total Qty OUT",
    latestOutboundTimestamp: "Latest Outbound Timestamp",

    // Status Badges & Buttons
    activeInWarehouse: "Active (In)",
    completedOut: "Completed (Out)",
    checkedOut: "Checked Out (Out)",
    matchInStock: "MATCH (IN STOCK)",
    missing: "MISSING",
    surplus: "SURPLUS",
    verifiedPresent: "VERIFIED PRESENT",
    missingUnscanned: "MISSING (NOT SCANNED)",
    viewUIDs: "View UIDs",
    hideUIDs: "Hide UIDs",
    searchPlaceholder: "Search material, SKU, UID, or SPK...",
    deleteTitle: "Delete item and erase tag",
    cancelScan: "Cancel Scan"
  },
  id: {
    // Navigation
    dashboard: "Dashboard",
    inventory: "Inventaris Gudang",
    stockOpname: "Stock Opname",
    inbound: "Barang Masuk",
    outbound: "Barang Keluar",
    masterData: "Master Data",
    settings: "Pengaturan & Akses",
    language: "Pilihan Bahasa",
    activeTerminal: "Terminal Aktif",
    rfidHardwareMode: "Mode Hardware RFID",
    connectUsb: "Hubungkan USB RFID",
    usbConnected: "USB RFID Terhubung",

    // Inbound Page
    inboundHubTitle: "Barang Masuk",
    inboundHubDesc: "Seluruh barang masuk yang terdaftar di inventaris gudang.",
    inboundListTitle: "Daftar Barang Masuk",
    inboundListDesc: "Daftar barang yang telah di-scan dan terdaftar di gudang",

    // Outbound Page
    outboundHubTitle: "Barang Keluar",
    outboundHubDesc: "Pantau dan kelola seluruh barang yang sudah di-scan OUT dari gudang dilengkapi timestamp.",
    outboundListTitle: "Kelompok Barang Keluar",
    outboundListDesc: "Kelompok material yang telah selesai di-scan OUT dari gudang",

    // Inventory Page
    inventoryHubTitle: "Inventaris Kelompok Material",
    inventoryHubDesc: "Tampilkan stok barang aktif gudang berdasarkan nama material dengan rincian accordion.",

    // Stock Opname Page
    stockOpnameTitle: "Stock Opname & Audit",
    stockOpnameDesc: "Cek dan cocokkan Stok Sistem vs Hasil Scan Fisik RFID secara real-time.",
    saveReportToFirebase: "Simpan Laporan ke Firebase",
    exportExcel: "Export Excel (.xlsx)",
    resetScan: "Reset Scan",
    realtimeScanner: "Scanner Audit Fisik Real-Time",
    auditSessionActive: "Sesi Audit Aktif",
    groupedReconciliation: "Rekonsiliasi Kelompok Material",
    showingAllMaterials: "Tampilkan Semua Material",
    auditedItemsOnly: "Hanya Item Di-Audit",
    noAuditScans: "Belum Ada Data Audit di Sesi Ini",
    noAuditScansDesc: "Silakan tempelkan kartu RFID barang di gudang untuk mulai membandingkan stok fisik dengan sistem.",
    firebaseAuditHistory: "Arsip Riwayat Laporan Stock Opname (Firebase)",
    auditDate: "Tanggal Audit",
    auditor: "Auditor / Operator",
    summary: "Ringkasan (Sistem vs Scan)",
    auditResult: "Hasil Audit",

    // Common Table Headers
    materialName: "Nama Material",
    materialAndDetails: "Nama Material & Rincian",
    materialAndBaseSku: "Nama Material & Base SKU",
    skuAndUid: "SKU & UID",
    supplier: "Pemasok / Supplier",
    sjAndSpk: "No. SJ & SPK",
    operator: "Operator Gudang",
    status: "Status Barang",
    action: "Aksi",
    actions: "Aksi",
    qtySystem: "Qty Sistem",
    qtyPhysical: "Qty Fisik (Scan)",
    variance: "Selisih",
    auditStatus: "Status Audit",
    totalQtyOut: "Total Qty Keluar",
    latestOutboundTimestamp: "Timestamp Outbound Terakhir",

    // Status Badges & Buttons
    activeInWarehouse: "Aktif (Di Gudang)",
    completedOut: "Selesai (Keluar)",
    checkedOut: "Keluar (Out)",
    matchInStock: "SESUAI (DI GUDANG)",
    missing: "BARANG HILANG",
    surplus: "BARANG LEBIH",
    verifiedPresent: "TERVERIFIKASI ADA",
    missingUnscanned: "BARANG HILANG (BELUM SCAN)",
    viewUIDs: "Lihat UID",
    hideUIDs: "Sembunyikan UID",
    searchPlaceholder: "Cari bahan, SKU, UID, atau SPK...",
    deleteTitle: "Hapus barang dan kartu",
    cancelScan: "Batal Scan"
  }
};

export function getCurrentLanguage() {
  if (typeof window === 'undefined') return 'en';
  return localStorage.getItem('app_language') || 'en';
}

export function setLanguage(lang) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('app_language', lang);
    window.dispatchEvent(new Event('languageChange'));
  }
}

export function useTranslation() {
  const [lang, setLang] = useState('en');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLang(getCurrentLanguage());
      const handleLangChange = () => setLang(getCurrentLanguage());
      window.addEventListener('languageChange', handleLangChange);
      return () => window.removeEventListener('languageChange', handleLangChange);
    }
  }, []);

  const t = (key) => {
    return translations[lang]?.[key] || translations['en']?.[key] || key;
  };

  return { lang, t };
}

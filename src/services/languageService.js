// Simple Lightweight Language Service for EN / ID switching
export const translations = {
  en: {
    dashboard: "Dashboard",
    inventory: "Inventory",
    stockOpname: "Stock Opname",
    inbound: "Inbound",
    outbound: "Outbound",
    masterData: "Master Data",
    settings: "Settings & Roles",
    language: "Language",
    activeInWarehouse: "Active in Warehouse",
    checkedOut: "Checked Out",
    rfidHardwareMode: "RFID Hardware Mode",
    connectUsb: "Connect USB RFID",
    scanOut: "Scan OUT",
    scanIn: "Scan IN",
    deleteErase: "Delete & Erase",
    cancelScan: "Cancel Scan",
    matchInStock: "MATCH (IN STOCK)",
    missing: "MISSING",
    surplus: "SURPLUS",
    saveToFirebase: "Save Audit Report to Firebase",
    exportExcel: "Export Excel (.xlsx)",
    searchPlaceholder: "Search material, SKU, UID, or SPK...",
    auditHistory: "Firebase Stock Opname Audit Report History",
    totalQtyOut: "Total Qty OUT",
    latestOutboundTimestamp: "Latest Outbound Timestamp",
    actions: "Actions",
    noData: "No data available",
    close: "Close"
  },
  id: {
    dashboard: "Dashboard",
    inventory: "Inventaris Gudang",
    stockOpname: "Stock Opname",
    inbound: "Barang Masuk (Inbound)",
    outbound: "Barang Keluar (Outbound)",
    masterData: "Master Data",
    settings: "Pengaturan & Akses",
    language: "Bahasa",
    activeInWarehouse: "Aktif di Gudang",
    checkedOut: "Sudah Keluar",
    rfidHardwareMode: "Mode Hardware RFID",
    connectUsb: "Hubungkan USB RFID",
    scanOut: "Scan OUT (Keluar)",
    scanIn: "Scan IN (Masuk)",
    deleteErase: "Hapus Barang",
    cancelScan: "Batal Scan",
    matchInStock: "SESUAI (DI GUDANG)",
    missing: "BARANG HILANG",
    surplus: "BARANG LEBIH",
    saveToFirebase: "Simpan Laporan ke Firebase",
    exportExcel: "Export Excel (.xlsx)",
    searchPlaceholder: "Cari bahan, SKU, UID, atau SPK...",
    auditHistory: "Arsip Riwayat Laporan Stock Opname (Firebase)",
    totalQtyOut: "Total Qty Keluar",
    latestOutboundTimestamp: "Timestamp Outbound Terakhir",
    actions: "Aksi",
    noData: "Tidak ada data",
    close: "Tutup"
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

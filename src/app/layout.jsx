import "./globals.css";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/sidebar/MobileNav";
import RfidModalManager from "@/components/dashboard/RfidModalManager";

export const metadata = {
  title: "Inventory System",
  description: "Stock & Warehouse Management System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-stone-50 text-stone-900 flex min-h-screen overflow-x-hidden pb-16 md:pb-0">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex shrink-0">
          <Sidebar />
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 lg:p-8 min-w-0">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <MobileNav />

        {/* Global Unified RFID Modal Manager */}
        <RfidModalManager />
      </body>
    </html>
  );
}

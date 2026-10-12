import React from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { UserProvider } from './context/UserContext';
import { Navbar } from './components/common/Navbar';
import { Toast } from './components/common/Toast';
import { StorefrontView } from './components/storefront/StorefrontView';
import { DashboardView } from './components/dashboard/DashboardView';
import { CartDrawer } from './components/storefront/CartDrawer';
import { ProductDetailModal } from './components/storefront/ProductDetailModal';
import { OrderTrackingModal } from './components/storefront/OrderTrackingModal';
import { InvoiceModal } from './components/storefront/InvoiceModal';
import { Footer } from './components/common/Footer';
import { AdminLoginModal } from './components/auth/AdminLoginModal';
import { UserAuthModal } from './components/auth/UserAuthModal';

const MainApp: React.FC = () => {
  const { 
    viewMode, 
    isTrackingModalOpen, 
    setIsTrackingModalOpen, 
    activeInvoiceOrder, 
    setActiveInvoiceOrder 
  } = useStore();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Universal Navigation */}
      <Navbar />

      {/* Main View Router */}
      <main style={{ flex: 1 }}>
        {viewMode === 'store' ? <StorefrontView /> : <DashboardView />}
      </main>

      {/* Storefront Footer */}
      <Footer />

      {/* Global Modals & Overlays */}
      <CartDrawer />
      <ProductDetailModal />
      <AdminLoginModal />
      <UserAuthModal />
      <OrderTrackingModal 
        isOpen={isTrackingModalOpen} 
        onClose={() => setIsTrackingModalOpen(false)} 
      />
      <InvoiceModal 
        order={activeInvoiceOrder} 
        onClose={() => setActiveInvoiceOrder(null)} 
      />
      <Toast />
    </div>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <UserProvider>
        <MainApp />
      </UserProvider>
    </StoreProvider>
  );
}

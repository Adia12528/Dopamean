import React, { useEffect, useRef, useState } from 'react';
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

const MIN_SPLASH_MS = 2400;
const MAX_SPLASH_MS = 5000;

const MainApp: React.FC = () => {
  const {
    viewMode,
    isTrackingModalOpen,
    setIsTrackingModalOpen,
    activeInvoiceOrder,
    setActiveInvoiceOrder,
    isLoading
  } = useStore();
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const splashStartRef = useRef<number | null>(null);

  useEffect(() => {
    splashStartRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (splashStartRef.current === null) {
      splashStartRef.current = Date.now();
    }

    if (isLoading) {
      const capTimer = window.setTimeout(() => setIsSplashVisible(false), MAX_SPLASH_MS);
      return () => window.clearTimeout(capTimer);
    }

    const elapsed = Date.now() - splashStartRef.current;
    const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
    const timer = window.setTimeout(() => setIsSplashVisible(false), remaining);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  return (
    <div className={`app-shell ${isSplashVisible ? 'app-shell-splashing' : ''}`} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {isSplashVisible && (
        <div className="app-splash" aria-live="polite" aria-busy={isLoading}>
          <div className="app-splash-panel">
            <div className="app-splash-mark">D</div>
            <div className="app-splash-copy">
              <span className="app-splash-kicker">Cozy Loops</span>
              <h1>Handcrafted joy, loading…</h1>
            </div>
            <div className="app-splash-loader" aria-hidden="true" />
          </div>
        </div>
      )}

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

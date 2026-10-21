import React, { useEffect, useMemo, useRef, useState } from 'react';
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
const SPLASH_SEEN_KEY = 'dopamean_intro_seen';

const MainApp: React.FC = () => {
  const {
    viewMode,
    isTrackingModalOpen,
    setIsTrackingModalOpen,
    activeInvoiceOrder,
    setActiveInvoiceOrder,
    isLoading,
    settings
  } = useStore();

  const [isSplashVisible, setIsSplashVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return !window.sessionStorage.getItem(SPLASH_SEEN_KEY);
  });
  const splashStartRef = useRef<number | null>(null);

  const hideSplash = useMemo(() => () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(SPLASH_SEEN_KEY, '1');
    }
    setIsSplashVisible(false);
  }, []);

  useEffect(() => {
    if (!isSplashVisible) return;
    splashStartRef.current = Date.now();

    const capTimer = window.setTimeout(() => hideSplash(), MAX_SPLASH_MS);
    const minTimer = window.setTimeout(() => {
      if (splashStartRef.current !== null) {
        hideSplash();
      }
    }, MIN_SPLASH_MS);

    return () => {
      window.clearTimeout(capTimer);
      window.clearTimeout(minTimer);
    };
  }, [hideSplash, isSplashVisible]);

  return (
    <div className={`app-shell ${isSplashVisible ? 'app-shell-splashing' : ''}`} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {isSplashVisible && (
        <div className="app-splash" aria-live="polite" aria-busy={isLoading} role="dialog" aria-modal="false">
          <div className="app-splash-glow" aria-hidden="true" />
          <div className="app-splash-panel">
            <span className="app-splash-badge">{settings.heroBadge || settings.storeName || 'Handcrafted with love'}</span>
            <h1>{settings.heroTitle || 'Cozy Loops by Deepa'}</h1>
            <p>{settings.heroSubtitle || 'Handmade pieces made to feel personal, warm, and beautiful.'}</p>
            <div className="app-splash-actions">
              <button type="button" className="btn-primary" onClick={hideSplash}>
                Enter Store
              </button>
              <button type="button" className="btn-secondary" onClick={hideSplash}>
                Skip intro
              </button>
            </div>
          </div>
          <button type="button" className="app-splash-skip" onClick={hideSplash} aria-label="Skip splash screen">
            Skip
          </button>
          <div className="app-splash-loader" aria-hidden="true" />
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

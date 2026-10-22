import React, { useEffect, useMemo, useRef, useState } from 'react';
import { preload } from 'react-dom';
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
import { getAssetUrl } from './services/api';
import { StorefrontImage } from './components/common/StorefrontImage';
import { SkeletonBlock } from './components/common/LoadingSkeleton';
import { getStorefrontImageUrl } from './lib/storefrontImageUrl';

const DEFAULT_SPLASH_DURATION_MS = 2500;
const SPLASH_FADE_MS = 360;
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
    return settings.introSplashEnabled !== false && !window.sessionStorage.getItem(SPLASH_SEEN_KEY);
  });
  const [isSplashMounted, setIsSplashMounted] = useState(isSplashVisible);
  const [loadedSplashImageUrl, setLoadedSplashImageUrl] = useState('');
  const [failedSplashImageUrl, setFailedSplashImageUrl] = useState('');
  const shouldShowSplash = isSplashVisible && settings.introSplashEnabled !== false;
  const splashStartedAt = useRef<number | null>(null);
  const splashImageUrl = getStorefrontImageUrl(
    getAssetUrl(settings.heroImage || '/uploads/hero_landing.webp'),
    { width: 1400, quality: 80 }
  );
  const isSplashImageReady = loadedSplashImageUrl === splashImageUrl || failedSplashImageUrl === splashImageUrl;

  if (viewMode === 'store' || shouldShowSplash) {
    preload(splashImageUrl, { as: 'image', fetchPriority: 'high' });
  }

  const hideSplash = useMemo(() => (markAsSeen = true) => {
    if (markAsSeen && typeof window !== 'undefined') {
      window.sessionStorage.setItem(SPLASH_SEEN_KEY, '1');
    }
    setIsSplashVisible(false);
  }, []);

  useEffect(() => {
    if (!shouldShowSplash) return;
    splashStartedAt.current ??= Date.now();
    const configuredDuration = Number(settings.introSplashDurationMs) || DEFAULT_SPLASH_DURATION_MS;
    const duration = Math.min(3000, Math.max(2000, configuredDuration));
    const maxDuration = duration + 1250;
    const deadline = splashStartedAt.current + (isSplashImageReady ? duration : maxDuration);
    const remainingDuration = Math.max(0, deadline - Date.now());
    const timer = window.setTimeout(() => {
      if (!isLoading) hideSplash();
    }, remainingDuration);
    return () => window.clearTimeout(timer);
  }, [hideSplash, isLoading, isSplashImageReady, shouldShowSplash, settings.introSplashDurationMs]);

  useEffect(() => {
    if (shouldShowSplash || !isSplashMounted) return;
    const timer = window.setTimeout(() => {
      setIsSplashMounted(false);
    }, SPLASH_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [isSplashMounted, shouldShowSplash]);

  return (
    <div className={`app-shell ${shouldShowSplash ? 'app-shell-splashing' : ''}`} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {isSplashMounted && (
        <div className={`app-splash${shouldShowSplash ? '' : ' is-exiting'}`} aria-live="polite" aria-busy={isLoading} role="dialog" aria-modal="false">
          {loadedSplashImageUrl !== splashImageUrl && (
            <SkeletonBlock className="app-splash-image-skeleton" />
          )}
          <StorefrontImage
            className="app-splash-image"
            src={getAssetUrl(settings.heroImage || '/uploads/hero_landing.webp')}
            alt=""
            width={1400}
            height={1050}
            transformWidth={1400}
            quality={80}
            loading="eager"
            fetchPriority="high"
            onLoad={() => setLoadedSplashImageUrl(splashImageUrl)}
            onError={() => setFailedSplashImageUrl(splashImageUrl)}
          />
          <div className="app-splash-glow" aria-hidden="true" />
          <div className="app-splash-panel">
            <span className="app-splash-badge">{settings.heroBadge || settings.storeName || 'Handcrafted with love'}</span>
            <h1>{settings.heroTitle || 'Cozy Loops by Deepa'}</h1>
            <p>{settings.heroSubtitle || 'Handmade pieces made to feel personal, warm, and beautiful.'}</p>
            <div className="app-splash-actions">
              <button type="button" className="btn-primary" onClick={() => hideSplash()}>
                Skip intro
              </button>
            </div>
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

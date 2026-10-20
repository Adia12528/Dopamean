import React, { Suspense, lazy } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { UserProvider, useUser } from './context/UserContext';
import { Navbar } from './components/common/Navbar';
import { Toast } from './components/common/Toast';

const StorefrontView = lazy(() => import('./components/storefront/StorefrontView').then(module => ({ default: module.StorefrontView })));
const Footer = lazy(() => import('./components/common/Footer').then(module => ({ default: module.Footer })));
const DashboardView = lazy(() => import('./components/dashboard/DashboardView').then(module => ({ default: module.DashboardView })));
const DeliveryDashboard = lazy(() => import('./components/delivery/DeliveryDashboard').then(module => ({ default: module.DeliveryDashboard })));
const CartDrawer = lazy(() => import('./components/storefront/CartDrawer').then(module => ({ default: module.CartDrawer })));
const ProductDetailModal = lazy(() => import('./components/storefront/ProductDetailModal').then(module => ({ default: module.ProductDetailModal })));
const OrderTrackingModal = lazy(() => import('./components/storefront/OrderTrackingModal').then(module => ({ default: module.OrderTrackingModal })));
const InvoiceModal = lazy(() => import('./components/storefront/InvoiceModal').then(module => ({ default: module.InvoiceModal })));
const AdminLoginModal = lazy(() => import('./components/auth/AdminLoginModal').then(module => ({ default: module.AdminLoginModal })));
const UserAuthModal = lazy(() => import('./components/auth/UserAuthModal').then(module => ({ default: module.UserAuthModal })));

const MainApp: React.FC = () => {
  const { 
    viewMode, 
    isAdminLoginModalOpen,
    isTrackingModalOpen, 
    setIsTrackingModalOpen, 
    isCartOpen,
    selectedProductForModal,
    activeInvoiceOrder, 
    setActiveInvoiceOrder 
  } = useStore();
  const { isUserAuthModalOpen } = useUser();

  // Delivery agent gets its own standalone portal — no navbar/footer clutter
  if (viewMode === 'delivery') {
    return (
      <>
        <Suspense fallback={<main className="container" role="status">Loading delivery dashboard…</main>}>
          <DeliveryDashboard />
        </Suspense>
        <Toast />
        {isAdminLoginModalOpen && <Suspense fallback={null}><AdminLoginModal /></Suspense>}
      </>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Universal Navigation */}
      <Navbar />

      {/* Main View Router */}
      <main style={{ flex: 1 }}>
        <Suspense fallback={<div className="container" role="status">Loading studio…</div>}>
          {viewMode === 'store' ? <StorefrontView /> : <DashboardView />}
        </Suspense>
      </main>

      {/* Storefront Footer */}
      <Suspense fallback={null}>
        <Footer />
      </Suspense>

      {/* Global Modals & Overlays */}
      <Suspense fallback={null}>
        {isCartOpen && <CartDrawer />}
        {selectedProductForModal && <ProductDetailModal />}
        {isAdminLoginModalOpen && <AdminLoginModal />}
        {isUserAuthModalOpen && <UserAuthModal />}
        {isTrackingModalOpen && (
          <OrderTrackingModal
            isOpen={isTrackingModalOpen}
            onClose={() => setIsTrackingModalOpen(false)}
          />
        )}
        {activeInvoiceOrder && (
          <InvoiceModal
            order={activeInvoiceOrder}
            onClose={() => setActiveInvoiceOrder(null)}
          />
        )}
      </Suspense>
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

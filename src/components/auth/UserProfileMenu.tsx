import React, { Suspense, lazy, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { useUser } from '../../context/UserContext';
import { useStore } from '../../context/StoreContext';
import { 
  User, UserRound, LogOut, Package, ChevronDown, MapPin, ArrowLeft,
  Phone, X, CheckCircle2, Clock, Loader2, Copy
} from 'lucide-react';
import type { Order } from '../../types';
import { getShortOrderId } from '../../lib/shortOrderId';
import { OrderCardSkeleton } from '../common/LoadingSkeleton';

const OrderStatusTimeline = lazy(() => import('../storefront/OrderStatusTimeline').then(module => ({ default: module.OrderStatusTimeline })));

// ─── Avatar bubble ────────────────────────────────────────────────────────────
const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 34 }) => {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #C85A32, #E07A5F)',
      color: '#FFFFFF', fontWeight: 800, fontSize: size * 0.38,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, userSelect: 'none', letterSpacing: '-0.02em'
    }}>{initials}</div>
  );
};

// ─── Order history card ───────────────────────────────────────────────────────
const OrderCard: React.FC<{ order: Order }> = ({ order }) => {
  const { settings, showToast } = useStore();
  const cur = settings.currency || '₹';
  const statusLabel = order.status.replace(/_/g, ' ');
  const shortOrderId = getShortOrderId(order.id);
  const handleCopyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(shortOrderId);
      showToast('Order ID copied.', 'success');
    } catch {
      showToast('Could not copy the order ID.', 'error');
    }
  };
  return (
    <div className="user-profile-order-card" style={{
      minWidth: 0, width: '100%', boxSizing: 'border-box',
      border: '1px solid var(--border-medium)', borderRadius: 12, padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 6, background: '#FAFAF9'
    }}>
      <div className="user-profile-order-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          <span style={{ minWidth: 0, overflowWrap: 'anywhere', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)' }}>#{shortOrderId}</span>
          <button type="button" aria-label={`Copy order ${shortOrderId}`} title="Copy order ID" onClick={() => void handleCopyOrderId()} style={{ minWidth: 44, minHeight: 44, display: 'grid', placeItems: 'center', flexShrink: 0, color: 'var(--text-muted)' }}>
            <Copy size={14} />
          </button>
        </div>
        <span className="user-profile-order-card-status" style={{
          maxWidth: '100%', overflowWrap: 'anywhere', whiteSpace: 'normal',
          fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999,
          backgroundColor: 'var(--accent-terracotta-light)', color: 'var(--accent-terracotta)', textTransform: 'capitalize'
        }}>{statusLabel}</span>
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        {order.items?.length} item{order.items?.length !== 1 ? 's' : ''} · {cur}{order.total?.toFixed(2)}
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
        {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
      </div>
      {order.paymentMethod === 'upi' && order.status !== 'cancelled' && (
        <>
          <span role="status" className={order.paymentStatus === 'paid' ? 'badge-sage' : 'badge-amber'} style={{ minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere', whiteSpace: 'normal', display: 'inline-flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start', textTransform: 'none', letterSpacing: 0 }}>
            {order.paymentStatus === 'paid' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
            {order.paymentStatus === 'paid' ? 'Payment verified' : 'Payment submitted; awaiting review'}
          </span>
          {order.upiRefNumber && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>Payment reference (UTR): {order.upiRefNumber}</span>}
          {order.upiCheckoutReference && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>UPI payment note: {order.upiCheckoutReference}</span>}
        </>
      )}
      <div style={{ minWidth: 0, borderTop: '1px solid var(--border-light)', paddingTop: '9px', marginTop: '3px' }}>
        <p style={{ margin: '0 0 8px', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-main)' }}>Delivery progress</p>
        <Suspense fallback={<p role="status" style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Loading delivery progress…</p>}>
          <OrderStatusTimeline order={order} settings={settings} compact />
        </Suspense>
      </div>
    </div>
  );
};

// ─── Edit Profile Form ────────────────────────────────────────────────────────
const EditProfileForm: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { currentUser, updateUserProfile } = useUser();
  const { showToast } = useStore();
  const [name, setName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [address, setAddress] = useState(currentUser?.address || '');
  const [city, setCity] = useState(currentUser?.city || '');
  const [pincode, setPincode] = useState(currentUser?.pincode || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    setLoading(true); setError('');
    try {
      await updateUserProfile({ name, phone, address, city, pincode });
      showToast('Profile updated! 🌸');
      onDone();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const field = (label: string, value: string, setter: (v: string) => void, type = 'text', ph = '') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => setter(e.target.value)}
        placeholder={ph}
        style={{
          padding: '9px 12px',
          minHeight: '40px',
          borderRadius: 8,
          border: '1px solid var(--border-medium)',
          fontSize: '16px', // Prevents iOS auto-zoom
          outline: 'none',
          backgroundColor: '#FFFFFF',
          color: 'var(--text-main)',
          boxSizing: 'border-box'
        }}
        onFocus={e => e.target.style.borderColor = 'var(--accent-terracotta)'}
        onBlur={e => e.target.style.borderColor = 'var(--border-medium)'}
      />
    </div>
  );

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {field('Full Name *', name, setName, 'text', 'Your name')}
      {field('Phone', phone, setPhone, 'tel', '+91 98765 43210')}
      {field('Delivery Address', address, setAddress, 'text', 'Street / Flat no.')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {field('City', city, setCity, 'text', 'City')}
        {field('Pincode', pincode, setPincode, 'text', '400001')}
      </div>
      {error && <p style={{ fontSize: '0.74rem', color: '#DC2626', fontWeight: 600, margin: 0 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button type="button" onClick={onDone}
          style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--border-medium)', fontSize: '0.82rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={loading}
          style={{ flex: 1, padding: '8px', fontSize: '0.82rem', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={14} />}
          {loading ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
};

// ─── Main dropdown ────────────────────────────────────────────────────────────
export const UserProfileMenu: React.FC<{ orderHistoryRequest?: number }> = ({ orderHistoryRequest = 0 }) => {
  const { currentUser, isUserLoggedIn, openUserAuthModal, userLogout, getUserOrders } = useUser();
  const { showToast } = useStore();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'orders' | 'edit'>('menu');
  const [orderHistory, setOrderHistory] = useState<{ ownerId: string; orders: Order[] }>({ ownerId: currentUser?.id || '', orders: [] });
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ left: 0, top: 0 });
  const [isClosing, setIsClosing] = useState(false);
  const previousUpiPaymentStatuses = useRef<Record<string, Order['paymentStatus']>>({});
  const currentOrderOwnerId = currentUser?.id || '';
  const activeOrderOwnerId = useRef(currentOrderOwnerId);
  const orders = orderHistory.ownerId === currentOrderOwnerId ? orderHistory.orders : [];
  const setOrders = useCallback((nextOrders: React.SetStateAction<Order[]>) => {
    setOrderHistory(previous => {
      const previousOrders = previous.ownerId === currentOrderOwnerId ? previous.orders : [];
      return {
        ownerId: currentOrderOwnerId,
        orders: typeof nextOrders === 'function' ? nextOrders(previousOrders) : nextOrders
      };
    });
  }, [currentOrderOwnerId]);

  const closeMenu = useCallback(() => {
    if (!open || isClosing) return;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      setView('menu');
      setIsClosing(false);
      closeTimerRef.current = null;
    }, 300);
  }, [isClosing, open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [closeMenu]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const isMobile = window.matchMedia('(max-width: 639px)').matches;
    if (isMobile) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = previousOverflow; };
    }

    const trigger = triggerRef.current?.getBoundingClientRect();
    const panel = panelRef.current?.getBoundingClientRect();
    if (!trigger || !panel) return;
    const left = Math.max(12, Math.min(trigger.right - panel.width, window.innerWidth - panel.width - 12));
    const top = Math.max(12, Math.min(trigger.bottom + 8, window.innerHeight - panel.height - 12));
    setPopoverPosition({ left, top });
  }, [open, view]);

  const refreshOrderStatuses = useCallback(async () => {
    const requestOwnerId = currentOrderOwnerId;
    if (!requestOwnerId) return;
    try {
      const myOrders = await getUserOrders();
      if (activeOrderOwnerId.current !== requestOwnerId) return;
      for (const order of myOrders) {
        if (order.paymentMethod === 'upi' && previousUpiPaymentStatuses.current[order.id] === 'pending' && order.paymentStatus === 'paid') {
          showToast(`UPI payment for order #${getShortOrderId(order.id)} has been verified.`, 'success');
        }
      }
      previousUpiPaymentStatuses.current = Object.fromEntries(
        myOrders.filter(order => order.paymentMethod === 'upi').map(order => [order.id, order.paymentStatus])
      );
      setOrders(myOrders);
      setOrdersError('');
    } catch (error) {
      if (activeOrderOwnerId.current !== requestOwnerId) return;
      setOrdersError(error instanceof Error ? error.message : 'Could not load your orders. Please try again.');
    }
  }, [currentOrderOwnerId, getUserOrders, setOrders, showToast]);

  useEffect(() => {
    activeOrderOwnerId.current = currentOrderOwnerId;
    previousUpiPaymentStatuses.current = {};
  }, [currentOrderOwnerId]);

  const handleOrdersClick = useCallback(() => {
    setView('orders');
    setLoadingOrders(true);
    setOrdersError('');
  }, []);

  useEffect(() => {
    if (!isUserLoggedIn || orderHistoryRequest === 0) return;
    const timeout = window.setTimeout(() => {
      setOpen(true);
      setIsClosing(false);
      void handleOrdersClick();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [handleOrdersClick, isUserLoggedIn, orderHistoryRequest]);

  useEffect(() => {
    if (!open || view !== 'orders') return;
    const refresh = () => {
      setLoadingOrders(true);
      void refreshOrderStatuses().finally(() => setLoadingOrders(false));
    };
    refresh();
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [open, refreshOrderStatuses, view]);

  if (!isUserLoggedIn) {
    return (
      <button
        onClick={() => openUserAuthModal('signin')}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
          borderRadius: 'var(--radius-full)', backgroundColor: 'transparent',
          border: '1px solid var(--border-medium)', color: 'var(--text-main)',
          fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer', transition: 'var(--transition-smooth)'
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-terracotta)'; e.currentTarget.style.color = 'var(--accent-terracotta)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-medium)'; e.currentTarget.style.color = 'var(--text-main)'; }}
      >
        <User size={15} />
        <span>Sign In</span>
      </button>
    );
  }

  // ── Logged-in avatar + dropdown ──
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => {
          if (open) {
            closeMenu();
          } else {
            if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
            setIsClosing(false);
            setOpen(true);
            setView('menu');
          }
        }}
        ref={triggerRef}
        aria-expanded={open}
        aria-haspopup="dialog"
        style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px 5px 5px',
          borderRadius: 999, border: '1.5px solid var(--border-medium)',
          backgroundColor: '#FFFFFF', cursor: 'pointer', transition: 'var(--transition-smooth)'
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-terracotta)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-medium)'}
      >
        <Avatar name={currentUser!.name} size={28} />
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentUser!.name.split(' ')[0]}
        </span>
        <ChevronDown size={14} style={{ color: 'var(--text-subtle)', transform: open ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
      </button>

      {open && (
        <div
          className={`user-profile-menu-backdrop mobile-drawer-overlay${isClosing ? ' user-profile-menu-closing' : ''}`}
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              closeMenu();
            }
          }}
        >
        <div
          ref={panelRef}
          className={`user-profile-menu-panel mobile-drawer-panel glass-card animate-slide-drawer${isClosing ? ' user-profile-menu-panel-closing' : ''}`}
          role="dialog"
          aria-label="Your account"
          style={{
          position: 'fixed', left: popoverPosition.left, top: popoverPosition.top, zIndex: 200,
          backgroundColor: 'rgba(255, 255, 255, 0.88)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-medium)', width: 320, minWidth: 280, maxWidth: 'calc(100vw - 24px)', overflow: 'hidden',
          boxSizing: 'border-box'
        }}>
          {/* Header */}
          <div className="user-profile-menu-header">
            <div className="user-profile-menu-identity">
              <Avatar name={currentUser!.name} size={40} />
              <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                <p style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentUser!.name}
                </p>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentUser!.email}
                </p>
              </div>
            </div>
            <button className="user-profile-menu-close" aria-label="Close account menu" onClick={closeMenu}>
              <X size={18} />
            </button>
          </div>

          {/* Saved info chips */}
          {view === 'menu' && (currentUser!.phone || currentUser!.address) && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {currentUser!.phone && (
                <span style={{ minWidth: 0, overflowWrap: 'anywhere', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Phone size={11} style={{ color: 'var(--accent-terracotta)', flexShrink: 0 }} />
                  <span>{currentUser!.phone}</span>
                </span>
                )}
                {currentUser!.address && (
                  <span style={{ minWidth: 0, overflowWrap: 'anywhere', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                    <MapPin size={11} style={{ color: 'var(--accent-terracotta)', flexShrink: 0, marginTop: 2 }} />
                    <span>{[currentUser!.address, currentUser!.city, currentUser!.pincode].filter(Boolean).join(', ')}</span>
                  </span>
                )}
            </div>
          )}

          {/* Content area */}
          <div className="user-profile-menu-content" style={{ padding: '8px 0', maxHeight: view === 'orders' ? 'min(70vh, 620px)' : 320, overflowY: 'auto' }}>
            {view === 'menu' && (
              <div className="user-profile-menu-view" key={view}>
                <div className="user-profile-menu-group">
                  <MenuButton icon={<Package size={18} />} label="My Orders" onClick={handleOrdersClick} />
                  <MenuButton icon={<UserRound size={18} />} label="My Profile" onClick={() => setView('edit')} />
                </div>
                <div className="user-profile-menu-divider" />
                <div className="user-profile-menu-group">
                  <MenuButton icon={<LogOut size={18} />} label="Sign Out" onClick={() => { userLogout(); setOpen(false); }} danger />
                </div>
              </div>
            )}

            {view === 'orders' && (
              <div className="user-profile-menu-view user-profile-menu-subview" key={view}>
                <div className="user-profile-menu-subview-header">
                  <button onClick={() => setView('menu')} aria-label="Back to account menu" className="user-profile-menu-back">
                    <ArrowLeft size={16} />
                    <span>Back</span>
                  </button>
                  <span>My Orders</span>
                </div>
                {loadingOrders ? (
                  <div role="status" aria-label="Loading orders" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[0, 1].map(order => <OrderCardSkeleton key={order} />)}
                  </div>
                ) : ordersError ? (
                  <p role="alert" style={{ fontSize: '0.82rem', color: '#B91C1C', textAlign: 'center', padding: '16px 0' }}>
                    {ordersError}
                  </p>
                ) : orders.length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                    No orders yet. Start shopping! 🛍️
                  </p>
                ) : (
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {orders.map(o => <OrderCard key={o.id} order={o} />)}
                  </div>
                )}
              </div>
            )}

            {view === 'edit' && (
              <div className="user-profile-menu-view user-profile-menu-subview" key={view}>
                <div className="user-profile-menu-subview-header">
                  <button onClick={() => setView('menu')} aria-label="Back to account menu" className="user-profile-menu-back">
                    <ArrowLeft size={16} />
                    <span>Back</span>
                  </button>
                  <span>My Profile</span>
                </div>
                <EditProfileForm onDone={() => setView('menu')} />
              </div>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
};

// ─── Menu Button ──────────────────────────────────────────────────────────────
const MenuButton: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }> = ({ icon, label, onClick, danger }) => (
  <button onClick={onClick} className={`user-profile-menu-item${danger ? ' user-profile-menu-item-danger' : ''}`}>
    <span className="user-profile-menu-item-icon">{icon}</span>
    <span>{label}</span>
  </button>
);

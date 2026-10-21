import React, { Suspense, lazy, useState, useRef, useEffect, useCallback } from 'react';
import { useUser } from '../../context/UserContext';
import { useStore } from '../../context/StoreContext';
import { 
  User, LogOut, Package, ChevronDown, MapPin, 
  Phone, Mail, Pencil, X, CheckCircle2, Clock, Loader2
} from 'lucide-react';
import type { Order } from '../../types';

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
  const { settings } = useStore();
  const cur = settings.currency || '₹';
  const statusLabel = order.status.replace(/_/g, ' ');
  return (
    <div style={{
      border: '1px solid var(--border-medium)', borderRadius: 12, padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 6, background: '#FAFAF9'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)' }}>#{order.id}</span>
        <span style={{
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
      {order.paymentMethod === 'upi' && (
        <>
          <span role="status" className={order.paymentStatus === 'paid' ? 'badge-sage' : 'badge-amber'} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start', textTransform: 'none', letterSpacing: 0 }}>
            {order.paymentStatus === 'paid' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
            {order.paymentStatus === 'paid' ? 'Payment verified' : 'Payment submitted; awaiting review'}
          </span>
          {order.upiRefNumber && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>Payment reference (UTR): {order.upiRefNumber}</span>}
          {order.upiCheckoutReference && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>UPI payment note: {order.upiCheckoutReference}</span>}
        </>
      )}
      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '9px', marginTop: '3px' }}>
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const previousUpiPaymentStatuses = useRef<Record<string, Order['paymentStatus']>>({});

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setView('menu');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const refreshOrderStatuses = useCallback(async () => {
    try {
      const myOrders = await getUserOrders();
      for (const order of myOrders) {
        if (order.paymentMethod === 'upi' && previousUpiPaymentStatuses.current[order.id] === 'pending' && order.paymentStatus === 'paid') {
          showToast(`UPI payment for order #${order.id} has been verified.`, 'success');
        }
      }
      previousUpiPaymentStatuses.current = Object.fromEntries(
        myOrders.filter(order => order.paymentMethod === 'upi').map(order => [order.id, order.paymentStatus])
      );
      setOrders(myOrders);
      setOrdersError('');
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : 'Could not load your orders. Please try again.');
    }
  }, [getUserOrders, showToast]);

  const handleOrdersClick = useCallback(async () => {
    setView('orders');
    setLoadingOrders(true);
    setOrdersError('');
    try {
      await refreshOrderStatuses();
    } finally {
      setLoadingOrders(false);
    }
  }, [refreshOrderStatuses]);

  useEffect(() => {
    if (!isUserLoggedIn || orderHistoryRequest === 0) return;
    const timeout = window.setTimeout(() => {
      setOpen(true);
      void handleOrdersClick();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [handleOrdersClick, isUserLoggedIn, orderHistoryRequest]);

  useEffect(() => {
    if (!open || view !== 'orders') return;
    const refresh = () => { void refreshOrderStatuses(); };
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
        onClick={() => { setOpen(!open); if (!open) setView('menu'); }}
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
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 200,
          backgroundColor: '#FFFFFF', borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.14)',
          border: '1px solid var(--border-medium)', minWidth: 280, maxWidth: 'calc(100vw - 24px)', overflow: 'hidden',
          boxSizing: 'border-box',
          animation: 'fadeIn 0.15s ease-out'
        }}>
          {/* Header */}
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name={currentUser!.name} size={40} />
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser!.name}
              </p>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser!.email}
              </p>
            </div>
            <button onClick={() => setOpen(false)} style={{ marginLeft: 'auto', color: 'var(--text-subtle)', cursor: 'pointer', flexShrink: 0 }}>
              <X size={14} />
            </button>
          </div>

          {/* Saved info chips */}
          {view === 'menu' && (currentUser!.phone || currentUser!.address) && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {currentUser!.phone && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Phone size={11} style={{ color: 'var(--accent-terracotta)' }} />{currentUser!.phone}
                </span>
              )}
              {currentUser!.address && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <MapPin size={11} style={{ color: 'var(--accent-terracotta)' }} />
                  {[currentUser!.address, currentUser!.city, currentUser!.pincode].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          )}

          {/* Content area */}
          <div style={{ padding: '8px 0', maxHeight: view === 'orders' ? 'min(70vh, 620px)' : 320, overflowY: 'auto' }}>
            {view === 'menu' && (
              <>
                <MenuButton icon={<Package size={15} />} label="My Orders" onClick={handleOrdersClick} />
                <MenuButton icon={<Pencil size={15} />} label="Edit Profile & Address" onClick={() => setView('edit')} />
                <MenuButton icon={<Mail size={15} />} label={currentUser!.email} onClick={() => {}} muted />
                <div style={{ height: 1, background: 'var(--border-light)', margin: '6px 0' }} />
                <MenuButton icon={<LogOut size={15} />} label="Sign Out" onClick={() => { userLogout(); setOpen(false); }} danger />
              </>
            )}

            {view === 'orders' && (
              <div style={{ padding: '0 12px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingTop: 4 }}>
                  <button onClick={() => setView('menu')} style={{ color: 'var(--text-subtle)', cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                    ← Back
                  </button>
                  <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-main)' }}>My Orders</span>
                </div>
                {loadingOrders ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
                    <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {orders.map(o => <OrderCard key={o.id} order={o} />)}
                  </div>
                )}
              </div>
            )}

            {view === 'edit' && (
              <div style={{ padding: '0 12px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingTop: 4 }}>
                  <button onClick={() => setView('menu')} style={{ color: 'var(--text-subtle)', cursor: 'pointer', fontSize: '0.78rem' }}>
                    ← Back
                  </button>
                  <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-main)' }}>Edit Profile</span>
                </div>
                <EditProfileForm onDone={() => setView('menu')} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Menu Button ──────────────────────────────────────────────────────────────
const MenuButton: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; muted?: boolean }> = ({ icon, label, onClick, danger, muted }) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 16px',
    fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left',
    color: danger ? '#DC2626' : muted ? 'var(--text-subtle)' : 'var(--text-main)',
    backgroundColor: 'transparent', transition: 'background 0.15s',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
  }}
    onMouseEnter={e => e.currentTarget.style.backgroundColor = danger ? '#FEF2F2' : 'var(--bg-surface-soft)'}
    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
  >
    <span style={{ flexShrink: 0 }}>{icon}</span>
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
  </button>
);

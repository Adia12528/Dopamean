import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { ShieldCheck, Lock, Eye, EyeOff, X, Truck, User, ShieldAlert, Package } from 'lucide-react';
import { useBackNavigationLayer } from '../../context/BackNavigationContext';

type AuthTier = 'delivery' | 'superadmin';

export const AdminLoginModal: React.FC = () => {
  const { isAdminLoginModalOpen, setIsAdminLoginModalOpen, adminLogin, deliveryAgentLogin } = useStore();

  const [tier, setTier] = useState<AuthTier>('delivery');

  // Delivery Agent
  const [deliveryPasscode, setDeliveryPasscode] = useState('');
  const [showDeliveryPw, setShowDeliveryPw] = useState(false);

  // Super Admin
  const [superAdminId, setSuperAdminId] = useState('');
  const [superAdminPassword, setSuperAdminPassword] = useState('');
  const [showSuperPw, setShowSuperPw] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setDeliveryPasscode(''); setSuperAdminId(''); setSuperAdminPassword('');
    setError(''); setLoading(false);
    setIsAdminLoginModalOpen(false);
  };
  useBackNavigationLayer('admin-login', isAdminLoginModalOpen, handleClose);

  if (!isAdminLoginModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let success = false;
      if (tier === 'delivery') {
        success = await deliveryAgentLogin(deliveryPasscode.trim());
        if (!success) setError('Invalid delivery agent passcode. Please check with your store admin.');
      } else {
        success = await adminLogin('', { superAdminId: superAdminId.trim(), superAdminPassword: superAdminPassword.trim() });
        if (!success) setError('Invalid Super Admin credentials. Verify your ID and password.');
      }
      if (success) {
        setDeliveryPasscode(''); setSuperAdminId(''); setSuperAdminPassword('');
        setError('');
      }
    } catch {
      setError('Authentication error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: '100%',
    minHeight: '46px',
    padding: '11px 44px 11px 40px',
    borderRadius: 12,
    border: `1.5px solid ${hasError ? '#DC2626' : 'var(--border-medium)'}`,
    fontSize: '16px',
    outline: 'none',
    backgroundColor: '#FFFFFF',
    color: 'var(--text-main)',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  });

  const tiers: { id: AuthTier; label: string; icon: React.ReactNode; desc: string; accentBg: string; accentText: string }[] = [
    {
      id: 'delivery',
      label: 'Delivery Agent',
      icon: <Truck size={18} />,
      desc: 'For delivery personnel — manage in-transit and delivery status updates.',
      accentBg: '#EFF6FF',
      accentText: '#1D4ED8'
    },
    {
      id: 'superadmin',
      label: 'Super Admin',
      icon: <ShieldAlert size={18} />,
      desc: 'Full studio access — manage products, orders, settings, and permissions.',
      accentBg: '#FFF5F5',
      accentText: '#B91C1C'
    }
  ];
  const activeTier = tiers.find(t => t.id === tier)!;

  return (
    <div
      className="mobile-modal-overlay"
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(10px, 3vw, 24px)', animation: 'fadeIn 0.2s ease-out', boxSizing: 'border-box'
      }}
    >
      <div
        className="mobile-modal-panel"
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 'clamp(18px, 4vw, 26px)',
          width: '100%', maxWidth: 460,
          maxHeight: 'min(96vh, 700px)',
          boxShadow: '0 30px 70px rgba(0,0,0,0.3)',
          border: '1px solid #E2E8F0',
          position: 'relative', padding: 'clamp(20px, 4vw, 32px) clamp(16px, 4vw, 28px)',
          display: 'flex', flexDirection: 'column', gap: 18,
          overflowY: 'auto', WebkitOverflowScrolling: 'touch', boxSizing: 'border-box'
        }}
      >
        {/* Close */}
        <button
          onClick={handleClose}
          aria-label="Close modal"
          style={{
            position: 'absolute', top: 14, right: 14,
            width: 36, height: 36, borderRadius: '50%',
            backgroundColor: 'var(--bg-surface-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', cursor: 'pointer', border: 'none', zIndex: 2
          }}
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', paddingTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
      <div style={{
              width: 54, height: 54, borderRadius: 18,
              backgroundColor: activeTier.accentBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: activeTier.accentText, boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
              transition: 'all 0.3s'
            }}>
              {tier === 'delivery' ? <Truck size={26} /> : <ShieldAlert size={26} />}
            </div>
          </div>
          <h3 style={{ fontSize: 'clamp(1.1rem, 3vw, 1.3rem)', fontWeight: 800, color: 'var(--text-main)', marginBottom: 4, marginTop: 0 }}>
            {tier === 'delivery' ? 'Delivery Agent Portal' : 'Super Admin Access'}
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0, maxWidth: 340, marginInline: 'auto' }}>
            {activeTier.desc}
          </p>
        </div>

        {/* Tier Selector */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8
        }}>
          {tiers.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTier(t.id); setError(''); }}
              style={{
                padding: '11px 10px', borderRadius: 14,
                fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                backgroundColor: tier === t.id ? t.accentBg : 'var(--bg-surface-soft)',
                color: tier === t.id ? t.accentText : 'var(--text-muted)',
                border: tier === t.id ? `2px solid ${t.accentText}30` : '2px solid transparent',
                boxShadow: tier === t.id ? `0 2px 10px ${t.accentText}18` : 'none',
                transition: 'all 0.2s'
              }}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Role Info Card */}
        <div style={{
          padding: '10px 14px', borderRadius: 12,
          backgroundColor: activeTier.accentBg,
          border: `1px dashed ${activeTier.accentText}40`,
          display: 'flex', alignItems: 'flex-start', gap: 10
        }}>
          <Package size={14} color={activeTier.accentText} style={{ marginTop: 1, flexShrink: 0 }} />
          <div>
            <p style={{ margin: 0, fontSize: '0.77rem', fontWeight: 700, color: activeTier.accentText }}>
              {tier === 'delivery' ? 'Delivery Agent Permissions' : 'Super Admin Permissions'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '0.73rem', color: activeTier.accentText, opacity: 0.75, lineHeight: 1.4 }}>
              {tier === 'delivery'
                ? 'Can mark orders as Out for Delivery and Delivered. Cannot access products, settings, or financials.'
                : 'Full access to Studio — products, orders, settings, commissions, and delivery agent management.'}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tier === 'delivery' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Delivery Agent Passcode
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, color: 'var(--text-subtle)', pointerEvents: 'none' }} />
                <input
                  type={showDeliveryPw ? 'text' : 'password'}
                  autoFocus
                  required
                  placeholder="Enter delivery passcode"
                  value={deliveryPasscode}
                  onChange={e => { setDeliveryPasscode(e.target.value); setError(''); }}
                  style={inputStyle(Boolean(error))}
                  onFocus={e => { e.target.style.borderColor = error ? '#DC2626' : '#2563EB'; }}
                  onBlur={e => { e.target.style.borderColor = error ? '#DC2626' : 'var(--border-medium)'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowDeliveryPw(!showDeliveryPw)}
                  aria-label={showDeliveryPw ? 'Hide passcode' : 'Show passcode'}
                  style={{
                    position: 'absolute', right: 8, width: 36, height: 36,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-subtle)', cursor: 'pointer', borderRadius: 8, border: 'none', background: 'none'
                  }}
                >
                  {showDeliveryPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p style={{ fontSize: '0.73rem', color: 'var(--text-subtle)', margin: '2px 0 0' }}>
                Ask the store admin to set or share the delivery-agent passcode.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Super Admin ID
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <User size={16} style={{ position: 'absolute', left: 14, color: 'var(--text-subtle)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    autoFocus
                    required
                    placeholder="Your super admin username"
                    value={superAdminId}
                    onChange={e => { setSuperAdminId(e.target.value); setError(''); }}
                    style={{ ...inputStyle(Boolean(error)), paddingLeft: 40, paddingRight: 14 }}
                    onFocus={e => { e.target.style.borderColor = error ? '#DC2626' : '#B91C1C'; }}
                    onBlur={e => { e.target.style.borderColor = error ? '#DC2626' : 'var(--border-medium)'; }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Super Admin Password
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Lock size={16} style={{ position: 'absolute', left: 14, color: 'var(--text-subtle)', pointerEvents: 'none' }} />
                  <input
                    type={showSuperPw ? 'text' : 'password'}
                    required
                    placeholder="Master password"
                    value={superAdminPassword}
                    onChange={e => { setSuperAdminPassword(e.target.value); setError(''); }}
                    style={inputStyle(Boolean(error))}
                    onFocus={e => { e.target.style.borderColor = error ? '#DC2626' : '#B91C1C'; }}
                    onBlur={e => { e.target.style.borderColor = error ? '#DC2626' : 'var(--border-medium)'; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSuperPw(!showSuperPw)}
                    aria-label={showSuperPw ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute', right: 8, width: 36, height: 36,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-subtle)', cursor: 'pointer', borderRadius: 8, border: 'none', background: 'none'
                    }}
                  >
                    {showSuperPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" style={{ fontSize: '0.8rem', color: '#DC2626', fontWeight: 600, margin: 0, padding: '8px 12px', backgroundColor: '#FEF2F2', borderRadius: 8, border: '1px solid #FECACA' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', minHeight: '48px', padding: '13px',
              fontSize: '0.94rem', fontWeight: 700, borderRadius: 14,
              border: 'none', cursor: loading ? 'wait' : 'pointer',
              background: tier === 'delivery'
                ? (loading ? '#93C5FD' : 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)')
                : (loading ? '#FCA5A5' : 'linear-gradient(135deg, #7F1D1D 0%, #DC2626 100%)'),
              color: '#FFFFFF',
              boxShadow: loading ? 'none' : tier === 'delivery'
                ? '0 4px 18px rgba(37,99,235,0.4)'
                : '0 4px 18px rgba(220,38,38,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s'
            }}
          >
            {loading ? (
              'Authenticating…'
            ) : tier === 'delivery' ? (
              <><Truck size={16} /> Enter Delivery Portal</>
            ) : (
              <><ShieldCheck size={16} /> Unlock Super Admin Studio</>
            )}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.73rem', color: 'var(--text-subtle)', margin: 0 }}>
          🔐 Secured connection — credentials are never stored in plaintext
        </p>
      </div>
    </div>
  );
};

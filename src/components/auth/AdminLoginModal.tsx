import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { ShieldCheck, Lock, Eye, EyeOff, X, KeyRound, User, ShieldAlert } from 'lucide-react';

type AdminTier = 'admin' | 'superadmin';

export const AdminLoginModal: React.FC = () => {
  const { isAdminLoginModalOpen, setIsAdminLoginModalOpen, adminLogin } = useStore();

  const [tier, setTier] = useState<AdminTier>('admin');

  // Tier 1: regular admin passcode
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);

  // Tier 2: super admin id + password
  const [superAdminId, setSuperAdminId] = useState('');
  const [superAdminPassword, setSuperAdminPassword] = useState('');
  const [showSuperPw, setShowSuperPw] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isAdminLoginModalOpen) return null;

  const handleClose = () => {
    setPasscode(''); setSuperAdminId(''); setSuperAdminPassword('');
    setError(''); setLoading(false);
    setIsAdminLoginModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const success = tier === 'superadmin'
        ? await adminLogin(passcode, { superAdminId: superAdminId.trim(), superAdminPassword: superAdminPassword.trim() })
        : await adminLogin(passcode);
      if (success) {
        setPasscode(''); setSuperAdminId(''); setSuperAdminPassword('');
        setError('');
      } else {
        setError(tier === 'superadmin'
          ? 'Invalid Super Admin credentials. Check the ID and password.'
          : 'Incorrect passcode. Try "admin123" or check Studio Settings.');
      }
    } catch {
      setError('Authentication error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(35, 28, 22, 0.65)',
        backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#FFFFFF', borderRadius: 24, width: '100%', maxWidth: 440,
          boxShadow: '0 25px 60px rgba(0,0,0,0.25)', border: '1px solid var(--border-medium)',
          position: 'relative', padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 20
        }}
      >
        {/* Close */}
        <button onClick={handleClose} style={{
          position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%',
          backgroundColor: 'var(--bg-surface-soft)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer'
        }}>
          <X size={18} />
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, backgroundColor: 'var(--accent-terracotta-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
            color: 'var(--accent-terracotta)', boxShadow: 'var(--shadow-sm)'
          }}>
            {tier === 'superadmin' ? <ShieldAlert size={28} /> : <ShieldCheck size={28} />}
          </div>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 6 }}>
            {tier === 'superadmin' ? 'Super Admin Access' : 'Studio Admin Access'}
          </h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {tier === 'superadmin'
              ? 'Restricted master access. Enter your Super Admin credentials to unlock all studio controls.'
              : 'Enter the studio passcode to access the admin dashboard.'}
          </p>
        </div>

        {/* Tier Tabs */}
        <div style={{ display: 'flex', backgroundColor: 'var(--bg-surface-soft)', borderRadius: 999, padding: 3, border: '1px solid var(--border-medium)' }}>
          {([['admin', 'Admin Login'], ['superadmin', 'Super Admin']] as [AdminTier, string][]).map(([t, label]) => (
            <button key={t} type="button" onClick={() => { setTier(t); setError(''); }} style={{
              flex: 1, padding: '7px 0', borderRadius: 999, fontSize: '0.84rem', fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.2s',
              backgroundColor: tier === t ? 'var(--accent-terracotta)' : 'transparent',
              color: tier === t ? '#FFFFFF' : 'var(--text-muted)',
              boxShadow: tier === t ? 'var(--shadow-sm)' : 'none'
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tier === 'admin' ? (
            /* ── Regular Admin Passcode ── */
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: 6, color: 'var(--text-main)' }}>
                Studio Passcode
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-subtle)' }} />
                <input
                  type={showPasscode ? 'text' : 'password'}
                  autoFocus required placeholder="Enter studio passcode"
                  value={passcode}
                  onChange={e => { setPasscode(e.target.value); setError(''); }}
                  style={{
                    width: '100%', padding: '10px 40px 10px 38px', borderRadius: 12,
                    border: `1.5px solid ${error ? '#DC2626' : 'var(--border-medium)'}`,
                    fontSize: '0.92rem', outline: 'none', backgroundColor: '#FFFFFF', color: 'var(--text-main)'
                  }}
                />
                <button type="button" onClick={() => setShowPasscode(!showPasscode)}
                  style={{ position: 'absolute', right: 12, top: 11, color: 'var(--text-subtle)', cursor: 'pointer' }}>
                  {showPasscode ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Info hint */}
              <div style={{
                backgroundColor: 'var(--bg-surface-soft)', padding: '10px 12px', borderRadius: 10,
                border: '1px dashed var(--border-medium)', display: 'flex', alignItems: 'center',
                gap: 8, fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 10
              }}>
                <KeyRound size={15} style={{ color: 'var(--accent-terracotta)', flexShrink: 0 }} />
                <span>Default passcode is <strong>admin123</strong>. Change it anytime in Studio Settings.</span>
              </div>
            </div>
          ) : (
            /* ── Super Admin ID + Password ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: 6, color: 'var(--text-main)' }}>
                  Super Admin ID
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-subtle)' }} />
                  <input
                    type="text" autoFocus required placeholder="Super Admin username"
                    value={superAdminId}
                    onChange={e => { setSuperAdminId(e.target.value); setError(''); }}
                    style={{
                      width: '100%', padding: '10px 14px 10px 38px', borderRadius: 12,
                      border: `1.5px solid ${error ? '#DC2626' : 'var(--border-medium)'}`,
                      fontSize: '0.92rem', outline: 'none', backgroundColor: '#FFFFFF', color: 'var(--text-main)'
                    }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: 6, color: 'var(--text-main)' }}>
                  Super Admin Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-subtle)' }} />
                  <input
                    type={showSuperPw ? 'text' : 'password'}
                    required placeholder="Master password"
                    value={superAdminPassword}
                    onChange={e => { setSuperAdminPassword(e.target.value); setError(''); }}
                    style={{
                      width: '100%', padding: '10px 40px 10px 38px', borderRadius: 12,
                      border: `1.5px solid ${error ? '#DC2626' : 'var(--border-medium)'}`,
                      fontSize: '0.92rem', outline: 'none', backgroundColor: '#FFFFFF', color: 'var(--text-main)'
                    }}
                  />
                  <button type="button" onClick={() => setShowSuperPw(!showSuperPw)}
                    style={{ position: 'absolute', right: 12, top: 11, color: 'var(--text-subtle)', cursor: 'pointer' }}>
                    {showSuperPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div style={{
                backgroundColor: '#FFF5F5', padding: '10px 12px', borderRadius: 10,
                border: '1px dashed #FECACA', display: 'flex', alignItems: 'center',
                gap: 8, fontSize: '0.78rem', color: '#B91C1C'
              }}>
                <ShieldAlert size={15} style={{ flexShrink: 0 }} />
                <span>Super Admin credentials are set in the server <strong>.env</strong> file and cannot be changed from here.</span>
              </div>
            </div>
          )}

          {error && <p style={{ fontSize: '0.76rem', color: '#DC2626', fontWeight: 600, margin: 0 }}>{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}
            style={{ width: '100%', padding: '12px', fontSize: '0.92rem', marginTop: 4, opacity: loading ? 0.75 : 1 }}>
            {loading ? 'Authenticating…' : tier === 'superadmin' ? 'Unlock Super Admin' : 'Unlock Studio Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { ShieldCheck, Lock, Eye, EyeOff, X, KeyRound } from 'lucide-react';

export const AdminLoginModal: React.FC = () => {
  const { isAdminLoginModalOpen, setIsAdminLoginModalOpen, adminLogin } = useStore();
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  if (!isAdminLoginModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setError('Please enter the Super Admin passcode');
      return;
    }
    const success = adminLogin(passcode);
    if (success) {
      setPasscode('');
      setError('');
    } else {
      setError('Incorrect passcode. Try "admin123" or check your Studio Settings.');
    }
  };

  const handleClose = () => {
    setPasscode('');
    setError('');
    setIsAdminLoginModalOpen(false);
  };

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(35, 28, 22, 0.65)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '440px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border-medium)',
          position: 'relative',
          padding: '32px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-surface-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            backgroundColor: 'var(--accent-terracotta-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
            color: 'var(--accent-terracotta)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <ShieldCheck size={28} />
          </div>

          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px' }}>
            Super Admin Access
          </h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Restricted to studio artisans and owners. Enter your master passcode to access product uploads, promotions, and sales tracking.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              Master Passcode
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-subtle)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                required
                placeholder="Enter admin passcode"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  setError('');
                }}
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 38px',
                  borderRadius: '12px',
                  border: error ? '1.5px solid #DC2626' : '1px solid var(--border-medium)',
                  fontSize: '0.92rem',
                  outline: 'none',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--text-main)'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '11px',
                  color: 'var(--text-subtle)',
                  cursor: 'pointer'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && (
              <p style={{ fontSize: '0.75rem', color: '#DC2626', marginTop: '6px', fontWeight: 600 }}>
                {error}
              </p>
            )}
          </div>

          {/* Quick default credential info badge */}
          <div style={{
            backgroundColor: 'var(--bg-surface-soft)',
            padding: '10px 12px',
            borderRadius: '10px',
            border: '1px dashed var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.78rem',
            color: 'var(--text-muted)'
          }}>
            <KeyRound size={15} style={{ color: 'var(--accent-terracotta)', flexShrink: 0 }} />
            <span>
              Initial default passcode is <strong>admin123</strong> (change anytime in Studio Settings).
            </span>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '0.92rem', marginTop: '4px' }}
          >
            <span>Unlock Studio Dashboard</span>
          </button>
        </form>
      </div>
    </div>
  );
};

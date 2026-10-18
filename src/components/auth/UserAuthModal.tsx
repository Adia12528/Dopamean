import React, { useState } from 'react';
import { useUser } from '../../context/UserContext';
import { X, Mail, Lock, Eye, EyeOff, User, Phone, Sparkles, ArrowRight, CheckCircle2, LogIn } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Shared input field component with 16px mobile-safe typography & touch targets
// ─────────────────────────────────────────────────────────────────────────────
interface InputFieldProps {
  label: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  icon?: React.ReactNode;
  rightAddon?: React.ReactNode;
  required?: boolean;
  error?: string;
  autoFocus?: boolean;
}

const InputField: React.FC<InputFieldProps> = ({
  label, type = 'text', placeholder, value, onChange, icon, rightAddon, required, error, autoFocus
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
      {label}{required && <span style={{ color: 'var(--accent-terracotta)', marginLeft: 3 }}>*</span>}
    </label>
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {icon && (
        <span style={{
          position: 'absolute',
          left: 14,
          color: 'var(--text-subtle)',
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'none'
        }}>
          {icon}
        </span>
      )}
      <input
        type={type}
        autoFocus={autoFocus}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          minHeight: '46px',
          padding: `11px ${rightAddon ? 44 : 14}px 11px ${icon ? 40 : 14}px`,
          borderRadius: 12,
          border: `1.5px solid ${error ? '#DC2626' : 'var(--border-medium)'}`,
          fontSize: '16px', // 16px prevents iOS Safari from automatically zooming in
          backgroundColor: '#FFFFFF',
          color: 'var(--text-main)',
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color 0.15s ease'
        }}
        onFocus={e => e.target.style.borderColor = error ? '#DC2626' : 'var(--accent-terracotta)'}
        onBlur={e => e.target.style.borderColor = error ? '#DC2626' : 'var(--border-medium)'}
      />
      {rightAddon && (
        <span style={{
          position: 'absolute',
          right: 8,
          display: 'flex',
          alignItems: 'center'
        }}>
          {rightAddon}
        </span>
      )}
    </div>
    {error && <p role="alert" style={{ fontSize: '0.74rem', color: '#DC2626', marginTop: 2, fontWeight: 600 }}>{error}</p>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Sign In Tab
// ─────────────────────────────────────────────────────────────────────────────
const SignInTab: React.FC<{ onSwitchToSignUp: () => void }> = ({ onSwitchToSignUp }) => {
  const { userLogin } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    try {
      await userLogin(email.trim(), password);
    } catch (err: unknown) {
      setError((err as Error).message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <InputField
        label="Email Address"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={v => { setEmail(v); setError(''); }}
        icon={<Mail size={16} />}
        required
        autoFocus
      />
      <InputField
        label="Password"
        type={showPw ? 'text' : 'password'}
        placeholder="Your password"
        value={password}
        onChange={v => { setPassword(v); setError(''); }}
        icon={<Lock size={16} />}
        required
        rightAddon={
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            aria-label={showPw ? 'Hide password' : 'Show password'}
            style={{
              color: 'var(--text-subtle)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 8
            }}
          >
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
      />
      {error && <p role="alert" style={{ fontSize: '0.78rem', color: '#DC2626', fontWeight: 600, margin: 0 }}>{error}</p>}
      <button
        type="submit"
        className="btn-primary"
        disabled={loading}
        style={{
          width: '100%',
          minHeight: '46px',
          padding: '12px',
          fontSize: '0.94rem',
          opacity: loading ? 0.75 : 1,
          marginTop: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          cursor: loading ? 'wait' : 'pointer'
        }}
      >
        {loading ? 'Signing in…' : <><LogIn size={17} /><span>Sign In to Account</span></>}
      </button>
      <p style={{ textAlign: 'center', fontSize: '0.84rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
        New here?{' '}
        <button
          type="button"
          onClick={onSwitchToSignUp}
          style={{
            color: 'var(--accent-terracotta)',
            fontWeight: 700,
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: '4px 2px'
          }}
        >
          Create an account
        </button>
      </p>
    </form>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sign Up Tab
// ─────────────────────────────────────────────────────────────────────────────
const SignUpTab: React.FC<{ onSwitchToSignIn: () => void }> = ({ onSwitchToSignIn }) => {
  const { userRegister } = useUser();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name || !email || !password) { setError('Name, email, and password are required.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await userRegister({ name: name.trim(), email: email.trim(), password, phone: phone.trim() });
    } catch (err: unknown) {
      setError((err as Error).message || 'Could not create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <InputField
        label="Full Name"
        placeholder="Priya Sharma"
        value={name}
        onChange={v => { setName(v); setError(''); }}
        icon={<User size={16} />}
        required
        autoFocus
      />
      <InputField
        label="Email Address"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={v => { setEmail(v); setError(''); }}
        icon={<Mail size={16} />}
        required
      />
      <InputField
        label="Phone Number (optional)"
        type="tel"
        placeholder="+91 98765 43210"
        value={phone}
        onChange={setPhone}
        icon={<Phone size={16} />}
      />
      <InputField
        label="Create Password"
        type={showPw ? 'text' : 'password'}
        placeholder="Min. 6 characters"
        value={password}
        onChange={v => { setPassword(v); setError(''); }}
        icon={<Lock size={16} />}
        required
        rightAddon={
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            aria-label={showPw ? 'Hide password' : 'Show password'}
            style={{
              color: 'var(--text-subtle)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 8
            }}
          >
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
      />
      <InputField
        label="Confirm Password"
        type={showPw ? 'text' : 'password'}
        placeholder="Re-enter password"
        value={confirm}
        onChange={v => { setConfirm(v); setError(''); }}
        icon={<Lock size={16} />}
        required
      />

      {error && <p role="alert" style={{ fontSize: '0.78rem', color: '#DC2626', fontWeight: 600, margin: 0 }}>{error}</p>}

      {/* Member benefits card */}
      <div style={{
        background: 'var(--bg-surface-soft)',
        borderRadius: 12,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        border: '1px solid var(--border-light)'
      }}>
        {['Saved addresses for one-click express checkout', 'Track live handcrafted parcel progress', 'Exclusive member discounts and launches'].map(b => (
          <span key={b} style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <CheckCircle2 size={14} style={{ color: 'var(--accent-sage)', flexShrink: 0 }} />
            <span>{b}</span>
          </span>
        ))}
      </div>

      <button
        type="submit"
        className="btn-primary"
        disabled={loading}
        style={{
          width: '100%',
          minHeight: '46px',
          padding: '12px',
          fontSize: '0.94rem',
          opacity: loading ? 0.75 : 1,
          marginTop: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          cursor: loading ? 'wait' : 'pointer'
        }}
      >
        {loading ? 'Creating account…' : <><Sparkles size={16} /><span>Create Free Account</span><ArrowRight size={16} /></>}
      </button>

      <p style={{ textAlign: 'center', fontSize: '0.84rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitchToSignIn}
          style={{
            color: 'var(--accent-terracotta)',
            fontWeight: 700,
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: '4px 2px'
          }}
        >
          Sign in
        </button>
      </p>
    </form>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Modal with Full Viewport & Device Responsiveness
// ─────────────────────────────────────────────────────────────────────────────
export const UserAuthModal: React.FC = () => {
  const { isUserAuthModalOpen, closeUserAuthModal, userAuthModalTab, setUserAuthModalTab } = useUser();

  if (!isUserAuthModalOpen) return null;

  const isSignIn = userAuthModalTab === 'signin';

  return (
    <div
      onClick={closeUserAuthModal}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(35, 28, 22, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(10px, 3vw, 24px)',
        animation: 'fadeIn 0.2s ease-out',
        boxSizing: 'border-box'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 'clamp(18px, 4vw, 26px)',
          width: '100%',
          maxWidth: 460,
          maxHeight: 'min(92vh, 740px)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.24)',
          border: '1px solid var(--border-medium)',
          position: 'relative',
          padding: 'clamp(20px, 4vw, 30px) clamp(16px, 4vw, 28px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          boxSizing: 'border-box'
        }}
      >
        {/* Close button with comfortable touch target */}
        <button
          onClick={closeUserAuthModal}
          aria-label="Close modal"
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor: 'var(--bg-surface-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'var(--transition-smooth)',
            border: 'none',
            zIndex: 2
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#EFE4DC'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-surface-soft)'}
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', paddingRight: 24, paddingLeft: 24 }}>
          <div style={{
            width: 50,
            height: 50,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #FDE1D3, #F5C6B0)',
            border: '1.5px dashed var(--accent-terracotta)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 10px',
            fontSize: 22,
            boxShadow: 'var(--shadow-sm)'
          }}>🧶</div>
          <h3 style={{ fontSize: 'clamp(1.2rem, 3vw, 1.35rem)', fontWeight: 800, color: 'var(--text-main)', marginBottom: 4 }}>
            {isSignIn ? 'Welcome Back! 🌸' : 'Join the Studio 🌸'}
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45, margin: 0 }}>
            {isSignIn
              ? 'Sign in to access your saved address, order history and exclusive offers.'
              : 'Create your free account for faster checkouts and live parcel tracking.'}
          </p>
        </div>

        {/* Tabs toggle */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--bg-surface-soft)',
          borderRadius: 999,
          padding: 3,
          border: '1px solid var(--border-medium)'
        }}>
          {(['signin', 'signup'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setUserAuthModalTab(tab)}
              style={{
                flex: 1,
                minHeight: '36px',
                padding: '8px 0',
                borderRadius: 999,
                fontSize: '0.86rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                backgroundColor: userAuthModalTab === tab ? 'var(--accent-terracotta)' : 'transparent',
                color: userAuthModalTab === tab ? '#FFFFFF' : 'var(--text-muted)',
                boxShadow: userAuthModalTab === tab ? 'var(--shadow-sm)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {tab === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* Form Body */}
        {isSignIn
          ? <SignInTab onSwitchToSignUp={() => setUserAuthModalTab('signup')} />
          : <SignUpTab onSwitchToSignIn={() => setUserAuthModalTab('signin')} />
        }
      </div>
    </div>
  );
};


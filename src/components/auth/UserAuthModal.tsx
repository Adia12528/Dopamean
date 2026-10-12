import React, { useState } from 'react';
import { useUser } from '../../context/UserContext';
import { X, Mail, Lock, Eye, EyeOff, User, Phone, Sparkles, ArrowRight, CheckCircle2, LogIn } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Shared input field component
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
  <div>
    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '5px', color: 'var(--text-main)' }}>
      {label}{required && <span style={{ color: 'var(--accent-terracotta)', marginLeft: 2 }}>*</span>}
    </label>
    <div style={{ position: 'relative' }}>
      {icon && <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)', display: 'flex' }}>{icon}</span>}
      <input
        type={type}
        autoFocus={autoFocus}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: `10px ${rightAddon ? 40 : 14}px 10px ${icon ? 38 : 14}px`,
          borderRadius: 12,
          border: `1.5px solid ${error ? '#DC2626' : 'var(--border-medium)'}`,
          fontSize: '0.9rem',
          backgroundColor: '#FFFFFF',
          color: 'var(--text-main)',
          outline: 'none',
          boxSizing: 'border-box'
        }}
        onFocus={e => e.target.style.borderColor = error ? '#DC2626' : 'var(--accent-terracotta)'}
        onBlur={e => e.target.style.borderColor = error ? '#DC2626' : 'var(--border-medium)'}
      />
      {rightAddon && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>{rightAddon}</span>}
    </div>
    {error && <p style={{ fontSize: '0.74rem', color: '#DC2626', marginTop: 4, fontWeight: 600 }}>{error}</p>}
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
      <InputField label="Email Address" type="email" placeholder="you@example.com" value={email}
        onChange={v => { setEmail(v); setError(''); }} icon={<Mail size={15} />} required autoFocus />
      <InputField label="Password" type={showPw ? 'text' : 'password'} placeholder="Your password" value={password}
        onChange={v => { setPassword(v); setError(''); }} icon={<Lock size={15} />} required
        rightAddon={
          <button type="button" onClick={() => setShowPw(!showPw)} style={{ color: 'var(--text-subtle)', cursor: 'pointer', display: 'flex' }}>
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        } />
      {error && <p style={{ fontSize: '0.76rem', color: '#DC2626', fontWeight: 600, margin: 0 }}>{error}</p>}
      <button type="submit" className="btn-primary" disabled={loading}
        style={{ width: '100%', padding: '12px', fontSize: '0.92rem', opacity: loading ? 0.7 : 1, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {loading ? 'Signing in…' : <><LogIn size={16} /><span>Sign In</span></>}
      </button>
      <p style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
        New here?{' '}
        <button type="button" onClick={onSwitchToSignUp}
          style={{ color: 'var(--accent-terracotta)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
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
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <InputField label="Full Name" placeholder="Priya Sharma" value={name}
        onChange={v => { setName(v); setError(''); }} icon={<User size={15} />} required autoFocus />
      <InputField label="Email Address" type="email" placeholder="you@example.com" value={email}
        onChange={v => { setEmail(v); setError(''); }} icon={<Mail size={15} />} required />
      <InputField label="Phone (optional)" type="tel" placeholder="+91 98765 43210" value={phone}
        onChange={setPhone} icon={<Phone size={15} />} />
      <InputField label="Password" type={showPw ? 'text' : 'password'} placeholder="Min. 6 characters" value={password}
        onChange={v => { setPassword(v); setError(''); }} icon={<Lock size={15} />} required
        rightAddon={
          <button type="button" onClick={() => setShowPw(!showPw)} style={{ color: 'var(--text-subtle)', cursor: 'pointer', display: 'flex' }}>
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        } />
      <InputField label="Confirm Password" type={showPw ? 'text' : 'password'} placeholder="Re-enter password" value={confirm}
        onChange={v => { setConfirm(v); setError(''); }} icon={<Lock size={15} />} required />
      {error && <p style={{ fontSize: '0.76rem', color: '#DC2626', fontWeight: 600, margin: 0 }}>{error}</p>}
      {/* Benefits */}
      <div style={{ background: 'var(--bg-surface-soft)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {['Saved address for faster checkout', 'View & track all your orders', 'Exclusive member offers'].map(b => (
          <span key={b} style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={13} style={{ color: 'var(--accent-sage)', flexShrink: 0 }} />{b}
          </span>
        ))}
      </div>
      <button type="submit" className="btn-primary" disabled={loading}
        style={{ width: '100%', padding: '12px', fontSize: '0.92rem', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {loading ? 'Creating account…' : <><Sparkles size={16} /><span>Create Account</span><ArrowRight size={16} /></>}
      </button>
      <p style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
        Already have an account?{' '}
        <button type="button" onClick={onSwitchToSignIn}
          style={{ color: 'var(--accent-terracotta)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
          Sign in
        </button>
      </p>
    </form>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────────────────────────────────────
export const UserAuthModal: React.FC = () => {
  const { isUserAuthModalOpen, closeUserAuthModal, userAuthModalTab, setUserAuthModalTab } = useUser();

  if (!isUserAuthModalOpen) return null;

  const isSignIn = userAuthModalTab === 'signin';

  return (
    <div
      onClick={closeUserAuthModal}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(35, 28, 22, 0.62)',
        backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#FFFFFF', borderRadius: 24, width: '100%', maxWidth: 460,
          boxShadow: '0 25px 60px rgba(0,0,0,0.22)', border: '1px solid var(--border-medium)',
          position: 'relative', padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', gap: 20
        }}
      >
        {/* Close */}
        <button onClick={closeUserAuthModal} style={{
          position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%',
          backgroundColor: 'var(--bg-surface-soft)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer'
        }}>
          <X size={18} />
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #FDE1D3, #F5C6B0)',
            border: '1.5px dashed var(--accent-terracotta)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px', fontSize: 24
          }}>🧶</div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 4 }}>
            {isSignIn ? 'Welcome Back! 🌸' : 'Join the Studio 🌸'}
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {isSignIn
              ? 'Sign in to access your saved address, order history and exclusive offers.'
              : 'Create your free account for faster checkouts and order tracking.'}
          </p>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', backgroundColor: 'var(--bg-surface-soft)',
          borderRadius: 999, padding: 3, border: '1px solid var(--border-medium)'
        }}>
          {(['signin', 'signup'] as const).map(tab => (
            <button key={tab} onClick={() => setUserAuthModalTab(tab)} style={{
              flex: 1, padding: '8px 0', borderRadius: 999, fontSize: '0.86rem', fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.2s',
              backgroundColor: userAuthModalTab === tab ? 'var(--accent-terracotta)' : 'transparent',
              color: userAuthModalTab === tab ? '#FFFFFF' : 'var(--text-muted)',
              boxShadow: userAuthModalTab === tab ? 'var(--shadow-sm)' : 'none'
            }}>
              {tab === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* Content */}
        {isSignIn
          ? <SignInTab onSwitchToSignUp={() => setUserAuthModalTab('signup')} />
          : <SignUpTab onSwitchToSignIn={() => setUserAuthModalTab('signin')} />
        }
      </div>
    </div>
  );
};

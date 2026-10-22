import React, { useState } from 'react';
import { useUser } from '../../context/UserContext';
import { useBackNavigationLayer } from '../../context/BackNavigationContext';
import { supabaseAuthEnabled } from '../../lib/supabase';
import { getAuthErrorMessage, isAuthRateLimitError } from '../../lib/authErrorMessage';
import { X, Mail, Lock, Eye, EyeOff, User, Phone, Sparkles, ArrowRight, CheckCircle2, LogIn, AlertCircle } from 'lucide-react';

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
  onBlur?: (value: string) => void;
}

const isInvalidCredentialsError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  return code === 'invalid_credentials' || error.message.toLowerCase() === 'invalid login credentials';
};

const InputField: React.FC<InputFieldProps> = ({
  label, type = 'text', placeholder, value, onChange, icon, rightAddon, required, error, autoFocus, onBlur
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
        aria-invalid={Boolean(error)}
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
        onBlur={e => {
          e.target.style.borderColor = error ? '#DC2626' : 'var(--border-medium)';
          onBlur?.(e.target.value);
        }}
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
// Google Brand Icon & Shared OAuth / Divider Components
// ─────────────────────────────────────────────────────────────────────────────
const GoogleIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

interface OAuthAuthButtonProps {
  text: string;
  providerName: string;
  icon?: React.ReactNode;
  loading: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const OAuthAuthButton: React.FC<OAuthAuthButtonProps> = ({ text, providerName, icon, loading, disabled, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);

  return (
    <button
      type="button"
      className="oauth-auth-button"
      onClick={onClick}
      disabled={loading || disabled}
      aria-busy={loading}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsActive(false); }}
      onMouseDown={() => setIsActive(true)}
      onMouseUp={() => setIsActive(false)}
      style={{
        width: '100%',
        minHeight: '46px',
        padding: '11px 16px',
        borderRadius: 12,
        border: `1.5px solid ${isHovered ? 'var(--text-subtle)' : 'var(--border-medium)'}`,
        backgroundColor: isHovered ? 'var(--bg-surface-soft)' : '#FFFFFF',
        color: 'var(--text-main)',
        fontSize: '0.94rem',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        cursor: (loading || disabled) ? 'not-allowed' : 'pointer',
        boxShadow: isHovered ? '0 2px 6px rgba(0, 0, 0, 0.06)' : '0 1px 2px rgba(0, 0, 0, 0.04)',
        transform: isActive ? 'scale(0.99)' : 'none',
        transition: 'all 0.15s ease',
        opacity: (loading || disabled) ? 0.75 : 1,
        boxSizing: 'border-box'
      }}
    >
      {loading ? (
        <>
          <div
            aria-hidden="true"
            style={{
              width: 17,
              height: 17,
              border: '2.5px solid var(--border-medium)',
              borderTopColor: 'var(--accent-terracotta)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              flexShrink: 0
            }}
          />
          <span role="status" aria-live="polite">Connecting to {providerName}…</span>
        </>
      ) : (
        <>
          {icon}
          <span>{text}</span>
        </>
      )}
    </button>
  );
};

const AuthDivider: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      margin: '2px 0',
      color: 'var(--text-subtle)',
      fontSize: '0.74rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    }}
  >
    <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-medium)' }} />
    <span>{label}</span>
    <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-medium)' }} />
  </div>
);

const AuthErrorBanner: React.FC<{ message: string; onDismiss: () => void }> = ({ message, onDismiss }) => (
  <div
    role="alert"
    style={{
      backgroundColor: '#FEF2F2',
      border: '1.5px solid #FCA5A5',
      borderRadius: 12,
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      fontSize: '0.82rem',
      color: '#B91C1C',
      lineHeight: 1.45
    }}
  >
    <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 1, color: '#DC2626' }} />
    <span style={{ flex: 1, fontWeight: 600 }}>{message}</span>
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss alert"
      style={{
        border: 'none',
        background: 'transparent',
        padding: 0,
        color: '#991B1B',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 20,
        height: 20,
        borderRadius: 4
      }}
    >
      <X size={15} />
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Sign In Tab
// ─────────────────────────────────────────────────────────────────────────────
const SignInTab: React.FC<{ onSwitchToSignUp: (email: string) => void }> = ({ onSwitchToSignUp }) => {
  const { userLogin, signInWithOAuth, authError, clearAuthError } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | 'facebook' | null>(null);
  const [oauthError, setOauthError] = useState('');
  const [showCreateAccountAction, setShowCreateAccountAction] = useState(false);

  const handleOAuthSignIn = async (provider: 'google' | 'github' | 'facebook') => {
    setOauthError('');
    setError('');
    clearAuthError();
    setOauthLoading(provider);
    try {
      await signInWithOAuth(provider);
    } catch (err: unknown) {
      setOauthLoading(null);
      const providerName = provider === 'facebook' ? 'Facebook' : provider === 'github' ? 'GitHub' : 'Google';
      const msg = err instanceof Error ? err.message : `${providerName} sign-in could not be started. Please try again.`;
      setOauthError(msg);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setShowCreateAccountAction(false);
    const normalizedEmail = email.trim();
    const nextEmailError = !normalizedEmail
      ? 'Email address is required.'
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
        ? 'Enter a valid email address.'
        : '';
    const nextPasswordError = password ? '' : 'Password is required.';
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError || nextPasswordError) return;
    setLoading(true);
    try {
      await userLogin(normalizedEmail, password);
    } catch (err: unknown) {
      if (isInvalidCredentialsError(err)) {
        setError('We couldn’t sign you in with those details.');
        setShowCreateAccountAction(true);
      } else {
        setError((err as Error).message || 'Could not sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Social sign-in */}
      {supabaseAuthEnabled && (
        <>
          <OAuthAuthButton
          text="Continue with Google"
          providerName="Google"
          icon={<GoogleIcon size={19} />}
          loading={oauthLoading === 'google'}
          disabled={loading || oauthLoading !== null}
          onClick={() => void handleOAuthSignIn('google')}
        />
          <OAuthAuthButton
            text="Continue with GitHub"
            providerName="GitHub"
            loading={oauthLoading === 'github'}
            disabled={loading || oauthLoading !== null}
            onClick={() => void handleOAuthSignIn('github')}
          />
          <OAuthAuthButton
            text="Continue with Facebook"
            providerName="Facebook"
            loading={oauthLoading === 'facebook'}
            disabled={loading || oauthLoading !== null}
            onClick={() => void handleOAuthSignIn('facebook')}
          />
        </>
      )}

      {(oauthError || authError) && (
        <AuthErrorBanner
          message={oauthError || authError || ''}
          onDismiss={() => { setOauthError(''); clearAuthError(); }}
        />
      )}

      {/* Divider */}
      {supabaseAuthEnabled && <AuthDivider label="or sign in with email" />}

      {/* Email / Password Form */}
      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <InputField
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={v => { setEmail(v); setError(''); setEmailError(''); setShowCreateAccountAction(false); }}
          icon={<Mail size={16} />}
          required
          error={emailError}
          onBlur={value => {
            const normalizedEmail = value.trim();
            setEmailError(normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
              ? 'Enter a valid email address.'
              : '');
          }}
          autoFocus
        />
        <InputField
          label="Password"
          type={showPw ? 'text' : 'password'}
          placeholder="Your password"
          value={password}
          onChange={v => { setPassword(v); setError(''); setPasswordError(''); setShowCreateAccountAction(false); }}
          icon={<Lock size={16} />}
          required
          error={passwordError}
          onBlur={value => setPasswordError(value ? '' : 'Password is required.')}
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
        {showCreateAccountAction && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
              If you’re new here, you can create an account with this email.
            </p>
            <button
              type="button"
              onClick={() => onSwitchToSignUp(email.trim())}
              style={{ alignSelf: 'flex-start', color: 'var(--accent-terracotta)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: '4px 0' }}
            >
              Create an account with this email
            </button>
          </div>
        )}
        <button
          type="submit"
          className="btn-primary"
          disabled={loading || oauthLoading !== null}
          style={{
            width: '100%',
            minHeight: '46px',
            padding: '12px',
            fontSize: '0.94rem',
            opacity: (loading || oauthLoading !== null) ? 0.75 : 1,
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
            onClick={() => onSwitchToSignUp(email.trim())}
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
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sign Up Tab
// ─────────────────────────────────────────────────────────────────────────────
const SignUpTab: React.FC<{ onSwitchToSignIn: () => void; initialEmail: string }> = ({ onSwitchToSignIn, initialEmail }) => {
  const { userRegister, userResendConfirmation, signInWithOAuth, authError, clearAuthError } = useUser();
  const [name, setName] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState('');
  const [isSignupRateLimited, setIsSignupRateLimited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | 'facebook' | null>(null);
  const [oauthError, setOauthError] = useState('');

  const handleOAuthSignIn = async (provider: 'google' | 'github' | 'facebook') => {
    setOauthError('');
    setError('');
    setIsSignupRateLimited(false);
    clearAuthError();
    setOauthLoading(provider);
    try {
      await signInWithOAuth(provider);
    } catch (err: unknown) {
      setOauthLoading(null);
      const providerName = provider === 'facebook' ? 'Facebook' : provider === 'github' ? 'GitHub' : 'Google';
      const msg = err instanceof Error ? err.message : `${providerName} sign-up could not be started. Please try again.`;
      setOauthError(msg);
    }
  };

  const handleResendConfirmation = async () => {
    setResendMessage('');
    setResendError('');
    setResending(true);
    try {
      await userResendConfirmation(email.trim());
      setResendMessage('A new confirmation email has been sent. Check your inbox.');
    } catch (err: unknown) {
      setResendError(getAuthErrorMessage(err, 'Could not resend the email. Please try again.'));
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSignupRateLimited(false);
    setConfirmationMessage('');
    setResendMessage('');
    setResendError('');
    const normalizedEmail = email.trim();
    const nextNameError = name.trim() ? '' : 'Name is required.';
    const nextEmailError = !normalizedEmail
      ? 'Email address is required.'
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
        ? 'Enter a valid email address.'
        : '';
    const nextPasswordError = !password
      ? 'Password is required.'
      : password.length < 6
        ? 'Password must be at least 6 characters.'
        : '';
    const nextConfirmError = !confirm
      ? 'Please confirm your password.'
      : password !== confirm
        ? 'Passwords do not match.'
        : '';
    setNameError(nextNameError);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setConfirmError(nextConfirmError);
    if (nextNameError || nextEmailError || nextPasswordError || nextConfirmError) return;
    setLoading(true);
    try {
      const result = await userRegister({ name: name.trim(), email: normalizedEmail, password, phone: phone.trim() });
      if (result === 'confirmation-required') {
        setConfirmationMessage('Account created. Check your email for a confirmation link before signing in.');
      }
    } catch (err: unknown) {
      setIsSignupRateLimited(isAuthRateLimitError(err));
      setError(getAuthErrorMessage(err, 'Could not create account. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Social sign-up */}
      {supabaseAuthEnabled && (
        <>
          <OAuthAuthButton
            text="Sign up with Google"
            providerName="Google"
            icon={<GoogleIcon size={19} />}
            loading={oauthLoading === 'google'}
            disabled={loading || oauthLoading !== null}
            onClick={() => void handleOAuthSignIn('google')}
          />
          <OAuthAuthButton
            text="Sign up with GitHub"
            providerName="GitHub"
            loading={oauthLoading === 'github'}
            disabled={loading || oauthLoading !== null}
            onClick={() => void handleOAuthSignIn('github')}
          />
          <OAuthAuthButton
            text="Sign up with Facebook"
            providerName="Facebook"
            loading={oauthLoading === 'facebook'}
            disabled={loading || oauthLoading !== null}
            onClick={() => void handleOAuthSignIn('facebook')}
          />
        </>
      )}

      {(oauthError || authError) && (
        <AuthErrorBanner
          message={oauthError || authError || ''}
          onDismiss={() => { setOauthError(''); clearAuthError(); }}
        />
      )}

      {/* Divider */}
      {supabaseAuthEnabled && <AuthDivider label="or sign up with email" />}

      {/* Registration credentials form */}
      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <InputField
          label="Full Name"
          placeholder="Priya Sharma"
          value={name}
        onChange={v => { setName(v); setError(''); setNameError(''); }}
        icon={<User size={16} />}
        required
        error={nameError}
        onBlur={value => setNameError(value.trim() ? '' : 'Name is required.')}
        autoFocus
      />
      <InputField
        label="Email Address"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={v => { setEmail(v); setError(''); setEmailError(''); }}
        icon={<Mail size={16} />}
        required
        error={emailError}
        onBlur={value => {
          const normalizedEmail = value.trim();
          setEmailError(!normalizedEmail
            ? 'Email address is required.'
            : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
              ? 'Enter a valid email address.'
              : '');
        }}
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
        onChange={v => { setPassword(v); setError(''); setPasswordError(''); setConfirmError(''); }}
        icon={<Lock size={16} />}
        required
        error={passwordError}
        onBlur={value => setPasswordError(!value
          ? 'Password is required.'
          : value.length < 6
            ? 'Password must be at least 6 characters.'
            : '')}
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
        onChange={v => { setConfirm(v); setError(''); setConfirmError(''); }}
        icon={<Lock size={16} />}
        required
        error={confirmError}
        onBlur={value => setConfirmError(!value
          ? 'Please confirm your password.'
          : value !== password
            ? 'Passwords do not match.'
            : '')}
      />

      {confirmationMessage && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p role="status" style={{ fontSize: '0.78rem', color: '#15803D', fontWeight: 600, margin: 0 }}>{confirmationMessage}</p>
          <button
            type="button"
            onClick={() => void handleResendConfirmation()}
            disabled={resending || loading}
            style={{ alignSelf: 'flex-start', color: 'var(--accent-terracotta)', fontWeight: 700, textDecoration: 'underline', cursor: resending ? 'wait' : 'pointer', padding: '4px 0' }}
          >
            {resending ? 'Sending confirmation email…' : 'Resend confirmation email'}
          </button>
          {resendMessage && <p role="status" style={{ fontSize: '0.76rem', color: '#15803D', margin: 0 }}>{resendMessage}</p>}
          {resendError && <p role="alert" style={{ fontSize: '0.76rem', color: '#DC2626', margin: 0 }}>{resendError}</p>}
        </div>
      )}
      {error && (
        <div role="alert" style={{ fontSize: '0.78rem', color: '#DC2626', fontWeight: 600, margin: 0 }}>
          <p style={{ margin: 0 }}>{error}</p>
          {isSignupRateLimited && supabaseAuthEnabled && (
            <p style={{ margin: '5px 0 0', color: 'var(--text-muted)', fontWeight: 500 }}>
              Or sign up with Google, GitHub, or Facebook using the buttons above.
            </p>
          )}
        </div>
      )}

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
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Modal with Full Viewport & Device Responsiveness
// ─────────────────────────────────────────────────────────────────────────────
export const UserAuthModal: React.FC = () => {
  const { isUserAuthModalOpen, closeUserAuthModal, userAuthModalTab, setUserAuthModalTab, clearAuthError } = useUser();
  useBackNavigationLayer('user-auth', isUserAuthModalOpen, closeUserAuthModal);
  useBackNavigationLayer('user-auth-signup', isUserAuthModalOpen && userAuthModalTab === 'signup', () => setUserAuthModalTab('signin'));
  const [signUpEmail, setSignUpEmail] = useState('');

  if (!isUserAuthModalOpen) return null;

  const isSignIn = userAuthModalTab === 'signin';

  return (
    <div
      className="mobile-modal-overlay"
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
        className="mobile-modal-panel"
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
              onClick={() => { setUserAuthModalTab(tab); clearAuthError(); }}
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
          ? <SignInTab onSwitchToSignUp={email => { setSignUpEmail(email); setUserAuthModalTab('signup'); clearAuthError(); }} />
          : <SignUpTab initialEmail={signUpEmail} onSwitchToSignIn={() => { setUserAuthModalTab('signin'); clearAuthError(); }} />
        }
      </div>
    </div>
  );
};

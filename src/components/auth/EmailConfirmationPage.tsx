import React, { useEffect, useState } from 'react';
import { CheckCircle2, LoaderCircle, Mail, RefreshCw } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { getSupabaseClient, supabaseAuthEnabled } from '../../lib/supabase';

type ConfirmationState = 'checking' | 'confirmed' | 'failed';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EmailConfirmationPage: React.FC<{ onContinue: (hasSession: boolean) => void }> = ({ onContinue }) => {
  const { userResendConfirmation } = useUser();
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>('checking');
  const [hasSession, setHasSession] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    let active = true;
    const currentUrl = new URL(window.location.href);
    const queryParams = currentUrl.searchParams;
    const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ''));
    const authError = queryParams.get('error_description')
      || hashParams.get('error_description')
      || queryParams.get('error')
      || hashParams.get('error');
    const hasAuthResponse = queryParams.has('code')
      || queryParams.has('access_token')
      || queryParams.has('token_hash')
      || hashParams.has('access_token')
      || hashParams.has('token_hash');
    const tokenHash = queryParams.get('token_hash') || hashParams.get('token_hash');
    const tokenType = queryParams.get('type') || hashParams.get('type');

    const clearAuthResponse = () => {
      window.history.replaceState({}, '', currentUrl.pathname);
    };

    const checkConfirmation = async () => {
      if (authError) {
        clearAuthResponse();
        if (active) setConfirmationState('failed');
        return;
      }
      if (!hasAuthResponse) {
        clearAuthResponse();
        if (active) setConfirmationState('failed');
        return;
      }

      try {
        if (!supabaseAuthEnabled) throw new Error('Customer email confirmation is unavailable.');
        const supabase = await getSupabaseClient();
        if (!supabase) throw new Error('Supabase Auth is enabled but its client is unavailable.');
        if (tokenHash) {
          if (tokenType !== 'signup' && tokenType !== 'email') {
            clearAuthResponse();
            if (active) setConfirmationState('failed');
            return;
          }
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: tokenType
          });
          if (error) throw error;
          clearAuthResponse();
          if (active) {
            setHasSession(Boolean(data.session));
            setConfirmationState(data.session || data.user?.email_confirmed_at ? 'confirmed' : 'failed');
          }
          return;
        }
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        clearAuthResponse();
        if (active) {
          setHasSession(Boolean(data.session));
          setConfirmationState(data.session ? 'confirmed' : 'failed');
        }
      } catch (error) {
        clearAuthResponse();
        if (active) {
          console.error('Could not process the customer email confirmation:', error);
          setConfirmationState('failed');
        }
      }
    };

    void checkConfirmation();
    return () => { active = false; };
  }, []);

  const handleResend = async (event: React.FormEvent) => {
    event.preventDefault();
    setResendMessage('');
    setResendError('');
    const normalizedEmail = email.trim();
    if (!emailPattern.test(normalizedEmail)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setEmailError('');
    setResending(true);
    try {
      await userResendConfirmation(normalizedEmail);
      setResendMessage('A new confirmation email has been sent. Check your inbox.');
    } catch (error: unknown) {
      setResendError((error as Error).message || 'Could not resend the email. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'var(--bg-main, #FBF8F5)' }}>
      <section style={{ width: '100%', maxWidth: 480, padding: 'clamp(24px, 6vw, 40px)', background: '#FFFFFF', border: '1px solid var(--border-light, #E8DED6)', borderRadius: 22, boxShadow: 'var(--shadow-md, 0 16px 40px rgba(35, 28, 22, 0.1))', textAlign: 'center', boxSizing: 'border-box' }}>
        {confirmationState === 'checking' && (
          <>
            <LoaderCircle size={38} aria-hidden="true" style={{ color: 'var(--accent-terracotta)', animation: 'spin 1s linear infinite' }} />
            <h1 style={{ margin: '18px 0 8px', color: 'var(--text-main)' }}>Confirming your email…</h1>
            <p role="status" style={{ margin: 0, color: 'var(--text-muted)' }}>Please wait while we verify your confirmation link.</p>
          </>
        )}

        {confirmationState === 'confirmed' && (
          <>
            <CheckCircle2 size={42} aria-hidden="true" style={{ color: 'var(--accent-sage, #15803D)' }} />
            <h1 style={{ margin: '18px 0 8px', color: 'var(--text-main)' }}>Email confirmed!</h1>
            <p style={{ margin: '0 0 20px', color: 'var(--text-muted)' }}>
              {hasSession
                ? 'Your email address is confirmed and you are signed in. Continue to Cozy Loops by Deepa.'
                : 'Your email address is confirmed. You can now sign in to Cozy Loops by Deepa.'}
            </p>
            <button type="button" className="btn-primary" onClick={() => onContinue(hasSession)} style={{ minHeight: 46, padding: '12px 20px' }}>
              {hasSession ? 'Continue to Cozy Loops' : 'Continue to Sign In'}
            </button>
          </>
        )}

        {confirmationState === 'failed' && (
          <>
            <Mail size={40} aria-hidden="true" style={{ color: 'var(--accent-terracotta)' }} />
            <h1 style={{ margin: '18px 0 8px', color: 'var(--text-main)' }}>We couldn’t confirm your email</h1>
            <p style={{ margin: '0 0 20px', color: 'var(--text-muted)' }}>This link may have expired or already been used. Enter the email you signed up with and we’ll send a new confirmation link.</p>
            <form onSubmit={handleResend} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
              <label htmlFor="confirmation-email" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Email address</label>
              <input
                id="confirmation-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={event => {
                  setEmail(event.target.value);
                  setEmailError('');
                  setResendError('');
                  setResendMessage('');
                }}
                onBlur={() => setEmailError(email.trim() && !emailPattern.test(email.trim()) ? 'Enter a valid email address.' : '')}
                aria-invalid={Boolean(emailError)}
                aria-describedby={emailError ? 'confirmation-email-error' : undefined}
                placeholder="you@example.com"
                style={{ minHeight: 46, padding: '11px 14px', borderRadius: 12, border: `1.5px solid ${emailError ? '#DC2626' : 'var(--border-medium, #D8CEC6)'}`, fontSize: 16, boxSizing: 'border-box' }}
              />
              {emailError && <p id="confirmation-email-error" role="alert" style={{ margin: 0, fontSize: '0.78rem', color: '#DC2626' }}>{emailError}</p>}
              <button type="submit" className="btn-primary" disabled={resending} style={{ minHeight: 46, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8, opacity: resending ? 0.75 : 1, cursor: resending ? 'wait' : 'pointer' }}>
                <RefreshCw size={16} aria-hidden="true" />
                {resending ? 'Sending confirmation email…' : 'Resend confirmation email'}
              </button>
              {resendMessage && <p role="status" style={{ margin: 0, fontSize: '0.8rem', color: '#15803D' }}>{resendMessage}</p>}
              {resendError && <p role="alert" style={{ margin: 0, fontSize: '0.8rem', color: '#DC2626' }}>{resendError}</p>}
            </form>
          </>
        )}
      </section>
    </main>
  );
};

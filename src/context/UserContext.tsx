import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { UserProfile, Order } from '../types';
import { api } from '../services/api';
import { getEmailConfirmationRedirectUrl, getOAuthRedirectUrl, getSupabaseClient, supabaseAuthEnabled } from '../lib/supabase';

const USER_TOKEN_KEY = 'dopamean_user_token';

const getOAuthRedirectError = () => {
  try {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    const errCode = url.searchParams.get('error') || hashParams.get('error');
    const errDesc = url.searchParams.get('error_description') || hashParams.get('error_description');
    if (!errCode && !errDesc) return null;

    let message = (errDesc || errCode || 'Social sign-in failed').replace(/\+/g, ' ');
    if (errCode === 'access_denied' || message.toLowerCase().includes('user cancelled') || message.toLowerCase().includes('declined') || message.toLowerCase().includes('denied')) {
      message = 'Sign-in was cancelled. You can try again or use email sign-in.';
    } else if (/email.*(required|missing|not provided)|(required|missing|not provided).*email/i.test(message)) {
      message = 'This provider did not share an email address. Try again with email access or use email sign-in.';
    }
    return message;
  } catch {
    return null;
  }
};

interface UserContextType {
  currentUser: UserProfile | null;
  userToken: string | null;
  isUserLoggedIn: boolean;
  isUserAuthModalOpen: boolean;
  userAuthModalTab: 'signin' | 'signup';
  isLoadingUser: boolean;
  authError: string | null;
  clearAuthError: () => void;

  openUserAuthModal: (tab?: 'signin' | 'signup', onAuthenticated?: () => void) => void;
  closeUserAuthModal: () => void;
  setUserAuthModalTab: (tab: 'signin' | 'signup') => void;

  userRegister: (data: { name: string; email: string; password: string; phone?: string }) => Promise<'signed-in' | 'confirmation-required'>;
  userResendConfirmation: (email: string) => Promise<void>;
  userLogin: (email: string, password: string) => Promise<void>;
  userLogout: () => void;
  signInWithOAuth: (provider: 'google' | 'github' | 'facebook') => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile> & { password?: string; currentPassword?: string }) => Promise<void>;
  getUserOrders: () => Promise<Order[]>;
}

/* eslint-disable react-refresh/only-export-components */
const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [initialOAuthError] = useState(getOAuthRedirectError);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [userToken, setUserToken] = useState<string | null>(() => {
    try { return localStorage.getItem(USER_TOKEN_KEY); } catch { return null; }
  });
  const [isUserAuthModalOpen, setIsUserAuthModalOpen] = useState(Boolean(initialOAuthError));
  const [userAuthModalTab, setUserAuthModalTab] = useState<'signin' | 'signup'>('signin');
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [authError, setAuthError] = useState<string | null>(initialOAuthError);
  const pendingAuthCallback = useRef<(() => void) | null>(null);
  const pendingProfileSyncs = useRef(new Map<string, Promise<UserProfile>>());

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const persistToken = (token: string) => {
    setUserToken(token);
    try { localStorage.setItem(USER_TOKEN_KEY, token); } catch { /* ignore */ }
  };

  const clearPersistedToken = () => {
    setUserToken(null);
    try { localStorage.removeItem(USER_TOKEN_KEY); } catch { /* ignore */ }
  };

  const syncSupabaseProfile = useCallback((token: string) => {
    const pending = pendingProfileSyncs.current.get(token);
    if (pending) return pending;

    const request = api.getMe(token).finally(() => {
      if (pendingProfileSyncs.current.get(token) === request) pendingProfileSyncs.current.delete(token);
    });
    pendingProfileSyncs.current.set(token, request);
    return request;
  }, []);

  const handleProfileSyncFailure = useCallback((error: unknown) => {
    clearPersistedToken();
    setCurrentUser(null);
    setAuthError(error instanceof Error
      ? error.message
      : 'Your sign-in worked, but we could not save your customer profile. Please try again.');
    setIsUserAuthModalOpen(true);
  }, []);

  const completeSignIn = useCallback((user: UserProfile) => {
    setCurrentUser(user);
    setAuthError(null);
    setIsUserAuthModalOpen(false);
    const callback = pendingAuthCallback.current;
    pendingAuthCallback.current = null;
    callback?.();
  }, []);

  // Rehydrate user from stored token or Supabase session on mount
  useEffect(() => {
    let active = true;

    // Remove OAuth error parameters after initializing the corresponding UI state.
    try {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
      const hasOAuthError = url.searchParams.has('error') || url.searchParams.has('error_description') || hashParams.has('error') || hashParams.has('error_description');
      if (hasOAuthError) {
        // Clean query/hash parameters from URL so browser history is clean
        url.searchParams.delete('error');
        url.searchParams.delete('error_code');
        url.searchParams.delete('error_description');
        const cleanSearch = url.searchParams.toString() ? `?${url.searchParams.toString()}` : '';
        window.history.replaceState({}, '', `${url.pathname}${cleanSearch}`);
      }
    } catch {
      // Ignore URL parsing errors
    }

    const restoreLocalToken = async () => {
      const stored = localStorage.getItem(USER_TOKEN_KEY);
      if (!stored) {
        if (active) setIsLoadingUser(false);
        return;
      }
      try {
        const user = await api.getMe(stored);
        if (active) {
          setUserToken(stored);
          setCurrentUser(user);
        }
      } catch {
        localStorage.removeItem(USER_TOKEN_KEY);
        if (active) {
          setUserToken(null);
          setCurrentUser(null);
        }
      } finally {
        if (active) setIsLoadingUser(false);
      }
    };

    if (supabaseAuthEnabled) {
      let unsubscribe: (() => void) | null = null;
      const restoreSupabaseSession = async () => {
        try {
          const supabase = await getSupabaseClient();
          if (!active) return;
          if (!supabase) {
            await restoreLocalToken();
            return;
          }

          const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
            const supaToken = session?.access_token || null;
            if (supaToken) {
              if (event === 'TOKEN_REFRESHED') {
                persistToken(supaToken);
                return;
              }
              if (event !== 'SIGNED_IN' && event !== 'USER_UPDATED') return;

              try {
                const user = await syncSupabaseProfile(supaToken);
                if (active) {
                  persistToken(supaToken);
                  completeSignIn(user);
                  setIsLoadingUser(false);

                  // Clean OAuth code or hash from address bar if present
                  try {
                    const currentUrl = new URL(window.location.href);
                    if (currentUrl.searchParams.has('code') || currentUrl.hash.includes('access_token')) {
                      currentUrl.searchParams.delete('code');
                      const cleanSearch = currentUrl.searchParams.toString() ? `?${currentUrl.searchParams.toString()}` : '';
                      window.history.replaceState({}, '', `${currentUrl.pathname}${cleanSearch}`);
                    }
                  } catch {
                    // Ignore URL cleanup error
                  }
                }
              } catch (error) {
                console.error('Could not load the signed-in customer profile:', error);
                if (active) {
                  handleProfileSyncFailure(error);
                  setIsLoadingUser(false);
                }
              }
            } else if (event === 'SIGNED_OUT') {
              if (active) {
                setCurrentUser(null);
                clearPersistedToken();
                setIsLoadingUser(false);
              }
            }
          });
          unsubscribe = () => listener.subscription.unsubscribe();

          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (!active) return;
          const supaToken = data.session?.access_token || null;
          if (supaToken) {
            try {
              const user = await syncSupabaseProfile(supaToken);
              if (active) {
                persistToken(supaToken);
                setCurrentUser(user);
                setAuthError(null);
                setIsUserAuthModalOpen(false);
              }
            } catch (error) {
              console.error('Could not load the signed-in customer profile:', error);
              if (active) handleProfileSyncFailure(error);
            } finally {
              if (active) setIsLoadingUser(false);
            }
          } else {
            await restoreLocalToken();
          }
        } catch (error) {
          if (active) {
            console.error('Could not restore the Supabase customer session:', error);
            await restoreLocalToken();
          }
        }
      };

      // Restore session immediately for smooth desktop and mobile redirects
      void restoreSupabaseSession();
      return () => {
        active = false;
        unsubscribe?.();
      };
    }

    void restoreLocalToken();
    return () => { active = false; };
  }, [completeSignIn, handleProfileSyncFailure, syncSupabaseProfile]);

  const openUserAuthModal = useCallback((tab: 'signin' | 'signup' = 'signin', onAuthenticated?: () => void) => {
    pendingAuthCallback.current = onAuthenticated || null;
    setUserAuthModalTab(tab);
    setIsUserAuthModalOpen(true);
  }, []);

  const closeUserAuthModal = useCallback(() => {
    pendingAuthCallback.current = null;
    setAuthError(null);
    setIsUserAuthModalOpen(false);
  }, []);

  const signInWithOAuth = useCallback(async (provider: 'google' | 'github' | 'facebook') => {
    setAuthError(null);
    if (!supabaseAuthEnabled) {
      throw new Error('Social sign-in is unavailable. Supabase authentication is not configured in this environment.');
    }
    const supabase = await getSupabaseClient();
    if (!supabase) {
      throw new Error('Could not initialize Supabase authentication client. Please try again or sign in with email.');
    }

    const redirectUrl = getOAuthRedirectUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
        ...(provider === 'google' ? {
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account'
          }
        } : provider === 'github'
          ? { scopes: 'read:user user:email' }
          : { scopes: 'email,public_profile' })
      }
    });

    if (error) {
      throw error;
    }

    if (data?.url) {
      window.location.assign(data.url);
    }
  }, []);

  const userRegister = useCallback(async (data: { name: string; email: string; password: string; phone?: string }): Promise<'signed-in' | 'confirmation-required'> => {
    if (supabaseAuthEnabled) {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Supabase Auth is enabled but its client is unavailable.');
      const { data: result, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { name: data.name, phone: data.phone || '' },
          emailRedirectTo: getEmailConfirmationRedirectUrl()
        }
      });
      if (error) throw error;
      if (!result.session?.access_token) return 'confirmation-required';

      const user = await syncSupabaseProfile(result.session.access_token);
      persistToken(result.session.access_token);
      completeSignIn(user);
      return 'signed-in';
    } else {
      const result = await api.userRegister(data);
      persistToken(result.token);
      completeSignIn(result.user);
      return 'signed-in';
    }
  }, [completeSignIn, syncSupabaseProfile]);

  const userResendConfirmation = useCallback(async (email: string) => {
    if (!supabaseAuthEnabled) {
      throw new Error('Email confirmation is not available right now.');
    }
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase Auth is enabled but its client is unavailable.');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: getEmailConfirmationRedirectUrl() }
    });
    if (error) throw error;
  }, []);

  const userLogin = useCallback(async (email: string, password: string) => {
    if (supabaseAuthEnabled) {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Supabase Auth is enabled but its client is unavailable.');
      const { data: result, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const token = result.session?.access_token;
      if (!token) throw new Error('Check your email and confirm your account before signing in.');
      const user = await syncSupabaseProfile(token);
      persistToken(token);
      completeSignIn(user);
      return;
    }
    const result = await api.userLogin(email, password);
    persistToken(result.token);
    completeSignIn(result.user);
  }, [completeSignIn, syncSupabaseProfile]);

  const userLogout = useCallback(() => {
    if (supabaseAuthEnabled) {
      void getSupabaseClient()
        .then(supabase => supabase?.auth.signOut())
        .catch(error => console.error('Could not sign out of Supabase:', error));
    }
    setCurrentUser(null);
    setUserToken(null);
    try { localStorage.removeItem(USER_TOKEN_KEY); } catch { /* ignore */ }
  }, []);

  const updateUserProfile = useCallback(async (updates: Partial<UserProfile> & { password?: string; currentPassword?: string }) => {
    if (!userToken) throw new Error('Not authenticated');
    const profileUpdates = { ...updates };
    const password = profileUpdates.password;
    delete profileUpdates.password;
    delete profileUpdates.currentPassword;
    if (password && supabaseAuthEnabled) {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Supabase Auth is enabled but its client is unavailable.');
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    }
    const updated = await api.updateMe(userToken, supabaseAuthEnabled ? profileUpdates : updates);
    setCurrentUser(updated);
  }, [userToken]);

  const getUserOrders = useCallback(async (): Promise<Order[]> => {
    if (!userToken) return [];
    return api.getMyOrders(userToken);
  }, [userToken]);

  return (
    <UserContext.Provider value={{
      currentUser,
      userToken,
      isUserLoggedIn: !!currentUser,
      isUserAuthModalOpen,
      userAuthModalTab,
      isLoadingUser,
      authError,
      clearAuthError,
      openUserAuthModal,
      closeUserAuthModal,
      setUserAuthModalTab,
      userRegister,
      userResendConfirmation,
      userLogin,
      userLogout,
      signInWithOAuth,
      updateUserProfile,
      getUserOrders,
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within a UserProvider');
  return ctx;
};

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { UserProfile, Order } from '../types';
import { api } from '../services/api';
import { getEmailConfirmationRedirectUrl, getOAuthRedirectUrl, getSupabaseClient, supabaseAuthEnabled } from '../lib/supabase';

const USER_TOKEN_KEY = 'dopamean_user_token';

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
  signInWithGoogle: () => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile> & { password?: string; currentPassword?: string }) => Promise<void>;
  getUserOrders: () => Promise<Order[]>;
}

/* eslint-disable react-refresh/only-export-components */
const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [userToken, setUserToken] = useState<string | null>(() => {
    try { return localStorage.getItem(USER_TOKEN_KEY); } catch { return null; }
  });
  const [isUserAuthModalOpen, setIsUserAuthModalOpen] = useState(false);
  const [userAuthModalTab, setUserAuthModalTab] = useState<'signin' | 'signup'>('signin');
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const pendingAuthCallback = useRef<(() => void) | null>(null);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const persistToken = (token: string) => {
    setUserToken(token);
    try { localStorage.setItem(USER_TOKEN_KEY, token); } catch { /* ignore */ }
  };

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

    // 1. Detect if OAuth redirect returned with an error (e.g. user cancelled or denied access)
    try {
      const url = new URL(window.location.href);
      const searchParams = url.searchParams;
      const hash = url.hash.replace(/^#/, '');
      const hashParams = new URLSearchParams(hash);

      const errCode = searchParams.get('error') || hashParams.get('error');
      const errDesc = searchParams.get('error_description') || hashParams.get('error_description');

      if (errCode || errDesc) {
        let msg = (errDesc || errCode || 'Google authentication failed').replace(/\+/g, ' ');
        if (errCode === 'access_denied' || msg.toLowerCase().includes('user cancelled') || msg.toLowerCase().includes('declined') || msg.toLowerCase().includes('denied')) {
          msg = 'Google sign-in was cancelled. You can sign in anytime or use your email.';
        }
        setAuthError(msg);
        setIsUserAuthModalOpen(true);

        // Clean query/hash parameters from URL so browser history is clean
        searchParams.delete('error');
        searchParams.delete('error_code');
        searchParams.delete('error_description');
        const cleanSearch = searchParams.toString() ? `?${searchParams.toString()}` : '';
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
              persistToken(supaToken);
              try {
                const user = await api.getMe(supaToken);
                if (active) {
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
                if (active) setIsLoadingUser(false);
              }
            } else if (event === 'SIGNED_OUT') {
              if (active) {
                setCurrentUser(null);
                setUserToken(null);
                try { localStorage.removeItem(USER_TOKEN_KEY); } catch { /* ignore */ }
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
            persistToken(supaToken);
            try {
              const user = await api.getMe(supaToken);
              if (active) {
                setCurrentUser(user);
                setIsUserAuthModalOpen(false);
              }
            } catch (error) {
              console.error('Could not load the signed-in customer profile:', error);
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
  }, [completeSignIn]);

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

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    if (!supabaseAuthEnabled) {
      throw new Error('Google Sign-In is unavailable. Supabase authentication is not configured in this environment.');
    }
    const supabase = await getSupabaseClient();
    if (!supabase) {
      throw new Error('Could not initialize Supabase authentication client. Please try again or sign in with email.');
    }

    const redirectUrl = getOAuthRedirectUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account'
        }
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

      persistToken(result.session.access_token);
      const user = await api.getMe(result.session.access_token);
      completeSignIn(user);
      return 'signed-in';
    } else {
      const result = await api.userRegister(data);
      persistToken(result.token);
      completeSignIn(result.user);
      return 'signed-in';
    }
  }, [completeSignIn]);

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
      persistToken(token);
      const user = await api.getMe(token);
      completeSignIn(user);
      return;
    }
    const result = await api.userLogin(email, password);
    persistToken(result.token);
    completeSignIn(result.user);
  }, [completeSignIn]);

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
      signInWithGoogle,
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

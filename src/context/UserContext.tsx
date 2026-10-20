import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { UserProfile, Order } from '../types';
import { api } from '../services/api';
import { getSupabaseClient, supabaseAuthEnabled } from '../lib/supabase';

const USER_TOKEN_KEY = 'dopamean_user_token';

interface UserContextType {
  currentUser: UserProfile | null;
  userToken: string | null;
  isUserLoggedIn: boolean;
  isUserAuthModalOpen: boolean;
  userAuthModalTab: 'signin' | 'signup';
  isLoadingUser: boolean;

  openUserAuthModal: (tab?: 'signin' | 'signup', onAuthenticated?: () => void) => void;
  closeUserAuthModal: () => void;
  setUserAuthModalTab: (tab: 'signin' | 'signup') => void;

  userRegister: (data: { name: string; email: string; password: string; phone?: string }) => Promise<'signed-in' | 'confirmation-required'>;
  userLogin: (email: string, password: string) => Promise<void>;
  userLogout: () => void;
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
  const pendingAuthCallback = useRef<(() => void) | null>(null);

  // Rehydrate user from stored token or Supabase session on mount
  useEffect(() => {
    let active = true;

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
          const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            const supaToken = session?.access_token || null;
            if (supaToken) {
              setUserToken(supaToken);
              api.getMe(supaToken)
                .then(user => { if (active) setCurrentUser(user); })
                .catch(error => console.error('Could not load the signed-in customer profile:', error));
            }
          });
          unsubscribe = () => listener.subscription.unsubscribe();
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (!active) return;
          const supaToken = data.session?.access_token || null;
          if (supaToken) {
            setUserToken(supaToken);
            try {
              const user = await api.getMe(supaToken);
              if (active) setCurrentUser(user);
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
      const timeoutId = window.setTimeout(() => { void restoreSupabaseSession(); }, 1000);
      return () => {
        active = false;
        window.clearTimeout(timeoutId);
        unsubscribe?.();
      };
    }

    void restoreLocalToken();
    return () => { active = false; };
  }, []);

  const persistToken = (token: string) => {
    setUserToken(token);
    try { localStorage.setItem(USER_TOKEN_KEY, token); } catch { /* ignore */ }
  };

  const openUserAuthModal = useCallback((tab: 'signin' | 'signup' = 'signin', onAuthenticated?: () => void) => {
    pendingAuthCallback.current = onAuthenticated || null;
    setUserAuthModalTab(tab);
    setIsUserAuthModalOpen(true);
  }, []);

  const closeUserAuthModal = useCallback(() => {
    pendingAuthCallback.current = null;
    setIsUserAuthModalOpen(false);
  }, []);

  const completeSignIn = useCallback((user: UserProfile) => {
    setCurrentUser(user);
    setIsUserAuthModalOpen(false);
    const callback = pendingAuthCallback.current;
    pendingAuthCallback.current = null;
    callback?.();
  }, []);

  const userRegister = useCallback(async (data: { name: string; email: string; password: string; phone?: string }): Promise<'signed-in' | 'confirmation-required'> => {
    if (supabaseAuthEnabled) {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Supabase Auth is enabled but its client is unavailable.');
      const { data: result, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { name: data.name, phone: data.phone || '' } }
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
      openUserAuthModal,
      closeUserAuthModal,
      setUserAuthModalTab,
      userRegister,
      userLogin,
      userLogout,
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

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { UserProfile, Order } from '../types';
import { api } from '../services/api';
import { supabase, supabaseAuthEnabled } from '../lib/supabase';

const USER_TOKEN_KEY = 'dopamean_user_token';

interface UserContextType {
  currentUser: UserProfile | null;
  userToken: string | null;
  isUserLoggedIn: boolean;
  isUserAuthModalOpen: boolean;
  userAuthModalTab: 'signin' | 'signup';
  isLoadingUser: boolean;

  openUserAuthModal: (tab?: 'signin' | 'signup') => void;
  closeUserAuthModal: () => void;
  setUserAuthModalTab: (tab: 'signin' | 'signup') => void;

  userRegister: (data: { name: string; email: string; password: string; phone?: string }) => Promise<void>;
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
  const [isLoadingUser, setIsLoadingUser] = useState(() => Boolean(userToken));

  // Rehydrate user from stored token on mount
  useEffect(() => {
    if (supabaseAuthEnabled && supabase) {
      let active = true;
      supabase.auth.getSession().then(({ data }) => {
        if (!active) return;
        const token = data.session?.access_token || null;
        setUserToken(token);
        if (!token) setIsLoadingUser(false);
      });
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        const token = session?.access_token || null;
        setUserToken(token);
        if (!token) { setCurrentUser(null); setIsLoadingUser(false); }
      });
      return () => { active = false; listener.subscription.unsubscribe(); };
    }
    if (!userToken) return;
    api.getMe(userToken)
      .then(user => setCurrentUser(user))
      .catch(() => {
        // Token invalid / expired — clear it
        localStorage.removeItem(USER_TOKEN_KEY);
        setUserToken(null);
      })
      .finally(() => setIsLoadingUser(false));
  }, [userToken]);

  const persistToken = (token: string) => {
    setUserToken(token);
    try { localStorage.setItem(USER_TOKEN_KEY, token); } catch { /* ignore */ }
  };

  const openUserAuthModal = useCallback((tab: 'signin' | 'signup' = 'signin') => {
    setUserAuthModalTab(tab);
    setIsUserAuthModalOpen(true);
  }, []);

  const closeUserAuthModal = useCallback(() => {
    setIsUserAuthModalOpen(false);
  }, []);

  const userRegister = useCallback(async (data: { name: string; email: string; password: string; phone?: string }) => {
    if (supabaseAuthEnabled && supabase) {
      const { data: result, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { name: data.name, phone: data.phone || '' } }
      });
      if (error) throw error;
      if (!result.session) throw new Error('Account created. Check your email to confirm it, then sign in.');
      persistToken(result.session.access_token);
      const user = await api.getMe(result.session.access_token);
      setCurrentUser(user);
      setIsUserAuthModalOpen(false);
      return;
    }
    const result = await api.userRegister(data);
    persistToken(result.token);
    setCurrentUser(result.user);
    setIsUserAuthModalOpen(false);
  }, []);

  const userLogin = useCallback(async (email: string, password: string) => {
    if (supabaseAuthEnabled && supabase) {
      const { data: result, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!result.session) throw new Error('Sign in could not be completed. Please try again.');
      persistToken(result.session.access_token);
      const user = await api.getMe(result.session.access_token);
      setCurrentUser(user);
      setIsUserAuthModalOpen(false);
      return;
    }
    const result = await api.userLogin(email, password);
    persistToken(result.token);
    setCurrentUser(result.user);
    setIsUserAuthModalOpen(false);
  }, []);

  const userLogout = useCallback(() => {
    if (supabaseAuthEnabled && supabase) void supabase.auth.signOut();
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
    if (password && supabaseAuthEnabled && supabase) {
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

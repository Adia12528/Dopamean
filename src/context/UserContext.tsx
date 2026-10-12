import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { UserProfile, Order } from '../types';
import { api } from '../services/api';

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
  const [isLoadingUser, setIsLoadingUser] = useState(false);

  // Rehydrate user from stored token on mount
  useEffect(() => {
    if (!userToken) return;
    setIsLoadingUser(true);
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
    const result = await api.userRegister(data);
    persistToken(result.token);
    setCurrentUser(result.user);
    setIsUserAuthModalOpen(false);
  }, []);

  const userLogin = useCallback(async (email: string, password: string) => {
    const result = await api.userLogin(email, password);
    persistToken(result.token);
    setCurrentUser(result.user);
    setIsUserAuthModalOpen(false);
  }, []);

  const userLogout = useCallback(() => {
    setCurrentUser(null);
    setUserToken(null);
    try { localStorage.removeItem(USER_TOKEN_KEY); } catch { /* ignore */ }
  }, []);

  const updateUserProfile = useCallback(async (updates: Partial<UserProfile> & { password?: string; currentPassword?: string }) => {
    if (!userToken) throw new Error('Not authenticated');
    const updated = await api.updateMe(userToken, updates);
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

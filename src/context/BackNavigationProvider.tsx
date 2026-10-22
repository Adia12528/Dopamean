import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useStore } from './StoreContext';
import { BackNavigationContext, type BackLayer, type BackSection, type BackState } from './BackNavigationContext';

const BASE_STATE: BackState = { owner: 'dopamean', type: 'base' };
const BACK_EXIT_WINDOW_MS = 2000;

export const BackNavigationProvider: React.FC<{
  children: React.ReactNode;
  section: BackSection;
}> = ({ children, section }) => {
  const { showToast } = useStore();
  const layersRef = useRef<BackLayer[]>([]);
  const blockersRef = useRef(new Set<string>());
  const pendingCloseRef = useRef<string | null>(null);
  const pendingRegistrationsRef = useRef<BackLayer[]>([]);
  const lastBaseBackAtRef = useRef(0);
  const showToastRef = useRef(showToast);
  const baseInitializedRef = useRef(false);

  useLayoutEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  const ensureBaseEntry = useCallback(() => {
    const state = window.history.state as BackState | null;
    if (baseInitializedRef.current || state?.owner === 'dopamean') {
      baseInitializedRef.current = true;
      return;
    }
    window.history.pushState(BASE_STATE, '', window.location.href);
    baseInitializedRef.current = true;
  }, []);

  const pushLayer = useCallback((layer: BackLayer) => {
    ensureBaseEntry();
    layersRef.current.push(layer);
    const state: BackState = { owner: 'dopamean', type: 'layer', id: layer.id };
    window.history.pushState(state, '', window.location.href);
  }, [ensureBaseEntry]);

  const registerLayer = useCallback((layer: BackLayer) => {
    if (pendingCloseRef.current) {
      pendingRegistrationsRef.current.push(layer);
    } else {
      pushLayer(layer);
    }

    return () => {
      const index = layersRef.current.findIndex(item => item.id === layer.id);
      if (index < 0) {
        const pendingIndex = pendingRegistrationsRef.current.findIndex(item => item.id === layer.id);
        if (pendingIndex >= 0) pendingRegistrationsRef.current.splice(pendingIndex, 1);
        return;
      }

      if (index !== layersRef.current.length - 1 || pendingCloseRef.current) {
        layersRef.current.splice(index, 1);
        return;
      }

      pendingCloseRef.current = layer.id;
      window.history.back();
    };
  }, [pushLayer]);

  const registerBlocker = useCallback((id: string, blocked: boolean) => {
    if (blocked) blockersRef.current.add(id);
    else blockersRef.current.delete(id);
  }, []);

  useLayoutEffect(() => {
    ensureBaseEntry();
  }, [ensureBaseEntry]);

  useEffect(() => {
    const onPopState = () => {
      const pendingClose = pendingCloseRef.current;
      if (pendingClose) {
        const top = layersRef.current.at(-1);
        if (top?.id === pendingClose) layersRef.current.pop();
        pendingCloseRef.current = null;
        for (const queued of pendingRegistrationsRef.current.splice(0)) pushLayer(queued);
        return;
      }

      if (blockersRef.current.size > 0) return;

      const top = layersRef.current.pop();
      if (top) {
        top.onBack();
        return;
      }

      const now = Date.now();
      if (now - lastBaseBackAtRef.current <= BACK_EXIT_WINDOW_MS) {
        lastBaseBackAtRef.current = 0;
        return;
      }

      lastBaseBackAtRef.current = now;
      showToastRef.current('Press back again to exit.', 'info');
      window.history.pushState(BASE_STATE, '', window.location.href);
      baseInitializedRef.current = true;
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [pushLayer]);

  useEffect(() => {
    lastBaseBackAtRef.current = 0;
  }, [section]);

  const value = useMemo(() => ({ registerLayer, registerBlocker }), [registerBlocker, registerLayer]);
  return <BackNavigationContext.Provider value={value}>{children}</BackNavigationContext.Provider>;
};

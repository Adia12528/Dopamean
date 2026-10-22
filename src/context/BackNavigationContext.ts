import { createContext, useContext, useLayoutEffect, useRef } from 'react';

export type BackSection = 'store' | 'studio' | 'delivery';

export interface BackLayer {
  id: string;
  onBack: () => void;
}

export interface BackState {
  owner: 'dopamean';
  type: 'base' | 'layer';
  id?: string;
}

export interface BackNavigationContextValue {
  registerLayer: (layer: BackLayer) => () => void;
  registerBlocker: (id: string, blocked: boolean) => void;
}

export const BackNavigationContext = createContext<BackNavigationContextValue | null>(null);

export const useBackNavigationLayer = (
  id: string,
  isOpen: boolean,
  onBack: () => void
) => {
  const context = useContext(BackNavigationContext);
  if (!context) throw new Error('Back navigation hooks must be used inside BackNavigationProvider.');
  const { registerLayer } = context;
  const onBackRef = useRef(onBack);

  useLayoutEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    return registerLayer({
      id,
      onBack: () => onBackRef.current()
    });
  }, [id, isOpen, registerLayer]);
};

export const useBackNavigationBlocker = (id: string, blocked: boolean) => {
  const context = useContext(BackNavigationContext);
  if (!context) throw new Error('Back navigation hooks must be used inside BackNavigationProvider.');
  const { registerBlocker } = context;

  useLayoutEffect(() => {
    registerBlocker(id, blocked);
    return () => registerBlocker(id, false);
  }, [blocked, id, registerBlocker]);
};

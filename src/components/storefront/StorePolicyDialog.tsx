import React from 'react';
import { useBackNavigationLayer } from '../../context/BackNavigationContext';
import { X } from 'lucide-react';
import type { StorePolicies, StoreSettings } from '../../types';

export type StorePolicyKey = keyof StorePolicies;

const POLICY_TITLES: Record<StorePolicyKey, string> = {
  termsAndConditions: 'Terms & Conditions',
  refundReturnPolicy: 'Refund & Return Policy',
  privacyPolicy: 'Privacy Policy',
  shippingPolicy: 'Shipping Policy'
};

interface StorePolicyDialogProps {
  policyKey: StorePolicyKey | null;
  policies?: StorePolicies;
  policyVersion?: number;
  settings: StoreSettings;
  onClose: () => void;
}

export const StorePolicyDialog: React.FC<StorePolicyDialogProps> = ({ policyKey, policies, policyVersion, settings, onClose }) => {
  useBackNavigationLayer('store-policy-dialog', Boolean(policyKey), onClose);
  if (!policyKey) return null;

  const policyText = (policies?.[policyKey] || '')
    .replaceAll('{{freeShippingThreshold}}', `${settings.currency}${settings.freeShippingThreshold}`)
    .replaceAll('{{contactEmail}}', settings.contactEmail || 'the store contact email');

  return (
    <div
      className="mobile-modal-overlay"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(10px, 3vw, 24px)', background: 'rgba(35, 28, 22, 0.65)', backdropFilter: 'blur(6px)', boxSizing: 'border-box' }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-policy-title"
        className="mobile-modal-panel glass-card"
        onClick={event => event.stopPropagation()}
        style={{ width: '100%', maxWidth: 680, maxHeight: 'min(88vh, 760px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#FFFFFF' }}
      >
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '16px 20px', borderBottom: '1px solid var(--border-light)' }}>
          <h2 id="store-policy-title" style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.08rem', fontWeight: 800 }}>{POLICY_TITLES[policyKey]}</h2>
          <button type="button" onClick={onClose} className="btn-outline" aria-label="Close policy" style={{ width: 38, height: 38, padding: 0, flexShrink: 0 }}>
            <X size={17} />
          </button>
        </header>
        <div style={{ overflowY: 'auto', padding: '20px', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: 1.7 }}>
            {policyText || 'This policy has not been published yet. Please contact the store before placing an order.'}
          </div>
          <p style={{ margin: '18px 0 0', color: 'var(--text-muted)', fontSize: '0.72rem' }}>Policy version {policyVersion || 1}</p>
        </div>
      </section>
    </div>
  );
};
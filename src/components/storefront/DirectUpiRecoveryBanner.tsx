import React, { useEffect, useState } from 'react';
import { ArrowRight, Clock } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useUser } from '../../context/UserContext';
import {
  DIRECT_UPI_RECOVERY_CHANGED_EVENT,
  DIRECT_UPI_RECOVERY_RESUME_EVENT,
  getDirectUpiCartSignature,
  readDirectUpiRecoveryDraft
} from '../../lib/directUpiRecovery';

export const DirectUpiRecoveryBanner: React.FC = () => {
  const { currentUser, isUserLoggedIn } = useUser();
  const { cart, setIsCartOpen } = useStore();
  const [draft, setDraft] = useState(readDirectUpiRecoveryDraft);
  const cartSignature = getDirectUpiCartSignature(cart);

  useEffect(() => {
    const refreshDraft = () => setDraft(readDirectUpiRecoveryDraft());
    window.addEventListener(DIRECT_UPI_RECOVERY_CHANGED_EVENT, refreshDraft);
    window.addEventListener('storage', refreshDraft);
    return () => {
      window.removeEventListener(DIRECT_UPI_RECOVERY_CHANGED_EVENT, refreshDraft);
      window.removeEventListener('storage', refreshDraft);
    };
  }, []);

  if (!isUserLoggedIn || !currentUser?.email || !draft || cart.length === 0 ||
    draft.email.toLowerCase() !== currentUser.email.toLowerCase() || draft.cartSignature !== cartSignature) return null;

  return (
    <section aria-live="polite" className="container" style={{ paddingTop: '16px' }}>
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', padding: '14px 16px' }}>
        <span role="status" className="badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textTransform: 'none', letterSpacing: 0 }}>
          <Clock size={15} />
          Saved UPI checkout. Return here to submit your payment reference.
        </span>
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new Event(DIRECT_UPI_RECOVERY_RESUME_EVENT));
            setIsCartOpen(true);
          }}
          className="btn-primary"
          style={{ flexShrink: 0, padding: '8px 12px', fontSize: '0.8rem' }}
        >
          <span>Resume checkout</span>
          <ArrowRight size={15} />
        </button>
      </div>
    </section>
  );
};
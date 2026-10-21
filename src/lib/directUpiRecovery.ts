export interface DirectUpiRecoveryDraft {
  email: string;
  cartSignature: string;
  reference: string;
  createdAt: number;
}

const DIRECT_UPI_RECOVERY_KEY = 'dopamean_direct_upi_recovery';
export const DIRECT_UPI_RECOVERY_CHANGED_EVENT = 'dopamean:direct-upi-recovery-changed';
export const DIRECT_UPI_RECOVERY_RESUME_EVENT = 'dopamean:resume-direct-upi-checkout';

export const getDirectUpiCartSignature = (cart: { product: { id: string }; quantity: number; selectedColor?: string }[]) =>
  JSON.stringify(cart.map(item => ({
    productId: item.product.id,
    quantity: item.quantity,
    selectedColor: item.selectedColor || ''
  })).sort((left, right) =>
    left.productId.localeCompare(right.productId) ||
    left.quantity - right.quantity ||
    left.selectedColor.localeCompare(right.selectedColor)
  ));

export const createDirectUpiCheckoutReference = () => {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `UPI-${id.toUpperCase()}`;
};

export const readDirectUpiRecoveryDraft = (): DirectUpiRecoveryDraft | null => {
  try {
    const value = localStorage.getItem(DIRECT_UPI_RECOVERY_KEY);
    if (!value) return null;
    const draft = JSON.parse(value) as DirectUpiRecoveryDraft;
    if (!draft.email || !draft.cartSignature || !draft.reference || !Number.isFinite(draft.createdAt)) return null;
    return draft;
  } catch {
    return null;
  }
};

export const saveDirectUpiRecoveryDraft = (draft: DirectUpiRecoveryDraft) => {
  try {
    localStorage.setItem(DIRECT_UPI_RECOVERY_KEY, JSON.stringify(draft));
    window.dispatchEvent(new Event(DIRECT_UPI_RECOVERY_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
};

export const clearDirectUpiRecoveryDraft = () => {
  try {
    localStorage.removeItem(DIRECT_UPI_RECOVERY_KEY);
  } catch {
    // Recovery is best effort when browser storage is unavailable.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DIRECT_UPI_RECOVERY_CHANGED_EVENT));
};
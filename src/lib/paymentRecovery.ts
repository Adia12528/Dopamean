export interface PendingPaymentReference {
  orderId: string;
  paymentMethod: 'razorpay' | 'payu';
  createdAt: number;
}

const STORAGE_KEY = 'dopamean_pending_payment_references';

const isPendingPaymentReference = (value: unknown): value is PendingPaymentReference => {
  if (!value || typeof value !== 'object') return false;
  const reference = value as Record<string, unknown>;
  return typeof reference.orderId === 'string' &&
    (reference.paymentMethod === 'razorpay' || reference.paymentMethod === 'payu') &&
    typeof reference.createdAt === 'number' &&
    Number.isFinite(reference.createdAt);
};

export const getPendingPaymentReferences = (): PendingPaymentReference[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed)) {
    throw new Error('Saved payment recovery information could not be read.');
  }

  if (!parsed.every(isPendingPaymentReference)) {
    throw new Error('Saved payment recovery information is incomplete. Check your order status before paying again.');
  }

  return parsed.filter(isPendingPaymentReference);
};

export const rememberPendingPayment = (
  orderId: string,
  paymentMethod: PendingPaymentReference['paymentMethod']
) => {
  const references = getPendingPaymentReferences().filter(reference => reference.orderId !== orderId);
  references.push({ orderId, paymentMethod, createdAt: Date.now() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(references));
};

export const forgetPendingPayment = (orderId: string) => {
  const references = getPendingPaymentReferences().filter(reference => reference.orderId !== orderId);
  if (references.length === 0) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(references));
  }
};

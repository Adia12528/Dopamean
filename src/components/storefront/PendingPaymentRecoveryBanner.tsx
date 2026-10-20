import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useStore } from '../../context/StoreContext';
import { api } from '../../services/api';
import type { Order } from '../../types';
import { forgetPendingPayment, getPendingPaymentReferences, type PendingPaymentReference } from '../../lib/paymentRecovery';
import { createWhatsAppUrl, getWhatsAppTemplate, isWhatsAppSupportEnabled, renderWhatsAppTemplate } from '../../lib/whatsapp';

type RecoveryStatus = {
  order?: Order;
  state: 'checking' | 'pending' | 'paid' | 'failed' | 'unavailable';
  checkedAt?: number;
  message?: string;
};

export const PendingPaymentRecoveryBanner: React.FC = () => {
  const { currentUser } = useUser();
  const { settings, cart, clearCart, setIsCartOpen } = useStore();
  const [references, setReferences] = useState<PendingPaymentReference[]>([]);
  const [statuses, setStatuses] = useState<Record<string, RecoveryStatus>>({});
  const [resolvedPayments, setResolvedPayments] = useState<Record<string, RecoveryStatus>>({});
  const [email, setEmail] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [storageError, setStorageError] = useState('');
  const isCheckingRef = useRef(false);

  useEffect(() => {
    try {
      setReferences(getPendingPaymentReferences());
      setStorageError('');
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Payment recovery details are unavailable.');
    }
  }, []);

  useEffect(() => {
    if (currentUser?.email) setEmail(currentUser.email);
  }, [currentUser?.email]);

  const checkStatuses = useCallback(async () => {
    const checkoutEmail = email.trim();
    if (!checkoutEmail || references.length === 0 || isCheckingRef.current) return;
    isCheckingRef.current = true;
    setIsChecking(true);
    setStatuses(previous => Object.fromEntries(
      references.map(reference => [
        reference.orderId,
        { ...previous[reference.orderId], state: 'checking' as const }
      ])
    ));

    const resolvedIds: string[] = [];
    for (const reference of references) {
      try {
        const orders = await api.trackOrder(reference.orderId, checkoutEmail);
        const order = orders.find(candidate => candidate.id === reference.orderId);
        if (!order) {
          setStatuses(previous => ({
            ...previous,
            [reference.orderId]: { state: 'unavailable', message: 'We could not confirm this order yet. Your order reference is saved.' }
          }));
          continue;
        }

        if (order.paymentStatus === 'paid') {
          resolvedIds.push(reference.orderId);
          const cartMatchesPaidOrder = cart.length === order.items.length &&
            cart.every(cartItem => order.items.some(orderItem =>
              orderItem.productId === cartItem.product.id && orderItem.quantity === cartItem.quantity
            ));
          if (cartMatchesPaidOrder) clearCart();
          const resolvedStatus = { state: 'paid' as const, order, checkedAt: Date.now() };
          setStatuses(previous => ({ ...previous, [reference.orderId]: resolvedStatus }));
          setResolvedPayments(previous => ({ ...previous, [reference.orderId]: resolvedStatus }));
        } else if (order.paymentStatus === 'failed' || order.status === 'cancelled') {
          resolvedIds.push(reference.orderId);
          const resolvedStatus = { state: 'failed' as const, order, checkedAt: Date.now() };
          setStatuses(previous => ({ ...previous, [reference.orderId]: resolvedStatus }));
          setResolvedPayments(previous => ({ ...previous, [reference.orderId]: resolvedStatus }));
        } else {
          setStatuses(previous => ({ ...previous, [reference.orderId]: { state: 'pending', order, checkedAt: Date.now() } }));
        }
      } catch (error) {
        setStatuses(previous => ({
          ...previous,
          [reference.orderId]: {
            state: 'unavailable',
            message: error instanceof Error
              ? 'We could not reach order tracking. We will keep checking when you are online.'
              : 'We could not reach order tracking. Your order reference is saved.'
          }
        }));
      }
    }

    try {
      if (resolvedIds.length > 0) {
        for (const orderId of resolvedIds) forgetPendingPayment(orderId);
        setReferences(previous => previous.filter(reference => !resolvedIds.includes(reference.orderId)));
      }
      setStorageError('');
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Could not update saved payment recovery details.');
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  }, [cart, clearCart, email, references]);

  useEffect(() => {
    if (!email.trim() || references.length === 0) return;
    void checkStatuses();
    const interval = window.setInterval(() => { void checkStatuses(); }, 15000);
    window.addEventListener('online', checkStatuses);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', checkStatuses);
    };
  }, [checkStatuses, email, references.length]);

  if (references.length === 0 && Object.keys(resolvedPayments).length === 0 && !storageError) return null;

  return (
    <section aria-live="polite" className="container" style={{ paddingTop: '16px' }}>
      <div style={{
        border: '1px solid var(--border-medium)',
        borderRadius: '16px',
        padding: '16px',
        background: '#FFFBEB',
        color: 'var(--text-main)'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          {isChecking ? <RefreshCw size={20} color="#B45309" /> : <AlertCircle size={20} color="#B45309" />}
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1rem', margin: '0 0 5px' }}>Checking a previous payment</h2>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.5, margin: 0, color: 'var(--text-muted)' }}>
              We’ll check the order directly with the store. Please don’t place the same order again until its status is clear.
            </p>
            {storageError && <p role="alert" style={{ color: '#B91C1C', fontSize: '0.82rem' }}>{storageError}</p>}
            {references.length > 0 && (
              <label style={{ display: 'block', marginTop: '12px', fontSize: '0.82rem', fontWeight: 600 }}>
                Checkout email
                <input
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="Email used for the order"
                  autoComplete="email"
                  style={{ display: 'block', width: '100%', maxWidth: '360px', padding: '10px', marginTop: '5px', border: '1px solid var(--border-medium)', borderRadius: '8px', fontSize: '16px' }}
                />
              </label>
            )}
            {references.map(reference => {
              const status = statuses[reference.orderId];
              const isPending = status?.state === 'pending' || status?.state === 'checking' || status?.state === 'unavailable' || !status;
              const olderThanThreeMinutes = Date.now() - reference.createdAt >= 3 * 60 * 1000;
              const supportUrl = isWhatsAppSupportEnabled(settings)
                ? createWhatsAppUrl(
                  settings.whatsappBusinessPhone || settings.contactPhone || '',
                  renderWhatsAppTemplate(getWhatsAppTemplate(settings, 'support'), { orderId: reference.orderId }),
                  settings.whatsappCountryCode || '91'
                )
                : null;
              return (
                <div key={reference.orderId} style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-medium)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 700, fontSize: '0.88rem' }}>
                    {status?.state === 'paid' ? <CheckCircle2 size={17} color="#15803D" /> : <Clock size={17} color="#B45309" />}
                    <span>
                      Order #{reference.orderId}:{' '}
                      {status?.state === 'paid' ? 'payment received and confirmed' :
                        status?.state === 'failed' ? 'payment was not completed' :
                          isChecking ? 'checking payment status…' : 'payment confirmation is pending'}
                    </span>
                  </div>
                  {(status?.state === 'unavailable' || !email) && (
                    <p style={{ margin: '6px 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {status?.message || 'Enter your checkout email to check this order.'}
                    </p>
                  )}
                  {isPending && olderThanThreeMinutes && (
                    <p style={{ margin: '7px 0', color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.45 }}>
                      This is taking longer than expected. Contact the store with order reference <strong>#{reference.orderId}</strong> before trying payment again.
                    </p>
                  )}
                  {status?.state === 'failed' && (
                    <button type="button" onClick={() => setIsCartOpen(true)} className="btn-secondary" style={{ marginTop: '8px' }}>
                      Return to your saved cart and try again
                    </button>
                  )}
                  {isPending && olderThanThreeMinutes && supportUrl && (
                    <a href={supportUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ display: 'inline-flex', marginTop: '8px', textDecoration: 'none' }}>
                      Contact support about order #{reference.orderId}
                    </a>
                  )}
                  {isPending && olderThanThreeMinutes && !supportUrl && settings.contactPhone && (
                    <a href={`tel:${settings.contactPhone.replace(/[^\d+]/g, '')}`} className="btn-secondary" style={{ display: 'inline-flex', marginTop: '8px', textDecoration: 'none' }}>
                      Call store support
                    </a>
                  )}
                </div>
              );
            })}
            {Object.entries(resolvedPayments).map(([orderId, status]) => (
              <div key={orderId} style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-medium)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 700, fontSize: '0.88rem' }}>
                  {status.state === 'paid' ? <CheckCircle2 size={17} color="#15803D" /> : <AlertCircle size={17} color="#B91C1C" />}
                  <span>
                    Order #{orderId}: {status.state === 'paid' ? 'payment received and confirmed' : 'payment was not completed'}
                  </span>
                </div>
                {status.state === 'failed' && (
                  <button type="button" onClick={() => setIsCartOpen(true)} className="btn-secondary" style={{ marginTop: '8px' }}>
                    Return to your saved cart and try again
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setResolvedPayments(previous => {
                    const next = { ...previous };
                    delete next[orderId];
                    return next;
                  })}
                  style={{ display: 'block', marginTop: '8px', border: 0, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem' }}
                >
                  Dismiss
                </button>
              </div>
            ))}
            {references.length > 0 && (
              <button
                type="button"
                onClick={() => void checkStatuses()}
                disabled={isChecking || !email.trim()}
                className="btn-secondary"
                style={{ marginTop: '12px' }}
              >
                {isChecking ? 'Checking…' : 'Check payment status'}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

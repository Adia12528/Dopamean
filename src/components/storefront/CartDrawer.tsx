import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { api } from '../../services/api';
import type { Order } from '../../types';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import { 
  X, 
  Trash2, 
  ShoppingBag, 
  ArrowRight, 
  Tag, 
  CheckCircle2, 
  CreditCard, 
  QrCode, 
  Truck, 
  FileText, 
  ShieldCheck
} from 'lucide-react';

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name: string;
    email: string;
    contact?: string;
  };
  theme?: {
    color: string;
  };
  handler?: (response: {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  }) => void | Promise<void>;
}

declare global {
  interface Window {
    Razorpay?: {
      new (options: RazorpayOptions): { open: () => void };
    };
  }
}

export const CartDrawer: React.FC = () => {
  const {
    isCartOpen,
    setIsCartOpen,
    cart,
    updateCartQuantity,
    removeFromCart,
    activePromo,
    applyPromoCode,
    removePromoCode,
    createOrder,
    settings,
    setIsTrackingModalOpen,
    setActiveInvoiceOrder
  } = useStore();

  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderComplete, setOrderComplete] = useState<Order | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payment method selection
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'razorpay' | 'cod' | 'whatsapp'>('upi');
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string>('');
  const [upiUtrNumber, setUpiUtrNumber] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });

  const subtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);

  let discount = 0;
  if (activePromo) {
    if (activePromo.discountType === 'percentage') {
      discount = (subtotal * activePromo.discountValue) / 100;
    } else {
      discount = Math.min(activePromo.discountValue, subtotal);
    }
  }

  const freeShippingThreshold = settings.freeShippingThreshold || 299;
  const isFreeShipping = subtotal >= freeShippingThreshold;
  const shippingCost = isFreeShipping || subtotal === 0 ? 0 : 40;
  const total = Math.max(0, subtotal - discount + shippingCost);

  // Generate UPI QR Code URL dynamically whenever paymentMethod is 'upi' or total changes
  useEffect(() => {
    if (paymentMethod === 'upi' && isCheckingOut) {
      const upiId = settings.upiId || 'cozyloops@upi';
      const payeeName = encodeURIComponent(settings.upiPayeeName || settings.storeName || 'Cozy Loops by Deepa');
      const upiUrl = `upi://pay?pa=${upiId}&pn=${payeeName}&am=${total.toFixed(2)}&cu=INR&tn=Cozy%20Loops%20Craft%20Order`;
      
      QRCode.toDataURL(upiUrl, {
        width: 220,
        margin: 1,
        color: {
          dark: '#1E293B',
          light: '#FFFFFF'
        }
      })
        .then((url: string) => setUpiQrDataUrl(url))
        .catch(() => console.warn('QR Code generation failed'));
    }
  }, [paymentMethod, isCheckingOut, total, settings.upiId, settings.upiPayeeName, settings.storeName]);

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoInput.trim()) return;
    const res = applyPromoCode(promoInput);
    if (!res.success) {
      setPromoError(res.message);
    } else {
      setPromoError('');
      setPromoInput('');
    }
  };

  const triggerCelebration = () => {
    try {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // Confetti fallback
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.address) return;

    setIsSubmitting(true);

    try {
      // 1. RAZORPAY ONLINE GATEWAY FLOW
      if (paymentMethod === 'razorpay' && settings.razorpayKeyId) {
        if (!window.Razorpay) {
          alert('Razorpay Checkout SDK is still loading. Please retry or choose UPI QR / COD.');
          setIsSubmitting(false);
          return;
        }

        const rzpOrder = await api.createRazorpayOrder({
          amount: total,
          currency: 'INR',
          notes: {
            customerName: formData.name,
            customerPhone: formData.phone
          }
        });

        const rzpOptions = {
          key: rzpOrder.keyId || settings.razorpayKeyId,
          amount: rzpOrder.amount,
          currency: rzpOrder.currency,
          name: settings.storeName,
          description: `Handcrafted Crochet Order (${cart.length} items)`,
          order_id: rzpOrder.orderId,
          prefill: {
            name: formData.name,
            email: formData.email,
            contact: formData.phone
          },
          theme: {
            color: settings.themeColor || '#C85A32'
          },
          handler: async (response: {
            razorpay_order_id?: string;
            razorpay_payment_id?: string;
            razorpay_signature?: string;
          }) => {
            const razorpayOrderId = response.razorpay_order_id ?? '';
            const razorpayPaymentId = response.razorpay_payment_id ?? '';
            const razorpaySignature = response.razorpay_signature ?? '';

            const placedOrder = await createOrder(formData, {
              method: 'razorpay',
              status: 'paid',
              razorpayOrderId,
              razorpayPaymentId
            });

            if (placedOrder) {
              await api.verifyRazorpayPayment({
                razorpay_order_id: razorpayOrderId,
                razorpay_payment_id: razorpayPaymentId,
                razorpay_signature: razorpaySignature,
                orderId: placedOrder.id
              });
              setOrderComplete(placedOrder);
              setIsCheckingOut(false);
              triggerCelebration();
            }
          }
        };

        const rzp = new window.Razorpay(rzpOptions);
        rzp.open();
        setIsSubmitting(false);
        return;
      }

      // 2. UPI QR / COD / WHATSAPP FLOW
      const placedOrder = await createOrder(formData, {
        method: paymentMethod,
        status: paymentMethod === 'upi' ? 'pending' : 'pending',
        upiRefNumber: upiUtrNumber.trim() || undefined
      });

      if (placedOrder) {
        setOrderComplete(placedOrder);
        setIsCheckingOut(false);
        triggerCelebration();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to place order. Please check your network connection.';
      alert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isCartOpen) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(35, 28, 22, 0.6)',
      backdropFilter: 'blur(6px)',
      zIndex: 60,
      display: 'flex',
      justifyContent: 'flex-end',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        backgroundColor: '#FFFFFF',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-10px 0 35px rgba(0, 0, 0, 0.15)',
        animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        position: 'relative'
      }}>
        {/* Drawer Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-medium)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#FAF7F2'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'var(--accent-terracotta-light)',
              color: 'var(--accent-terracotta)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShoppingBag size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                {isCheckingOut ? 'Express Checkout' : 'Your Craft Bag'}
              </h3>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                {cart.length} handcrafted {cart.length === 1 ? 'item' : 'items'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setIsCartOpen(false);
              setOrderComplete(null);
              setIsCheckingOut(false);
            }}
            style={{
              padding: '6px',
              borderRadius: '50%',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              border: 'none',
              background: 'transparent'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Free shipping progress bar */}
        {cart.length > 0 && !orderComplete && !isCheckingOut && (
          <div style={{
            padding: '12px 24px',
            backgroundColor: isFreeShipping ? 'var(--accent-sage-light)' : '#FFFBEB',
            borderBottom: '1px solid var(--border-light)',
            fontSize: '0.8rem',
            color: isFreeShipping ? 'var(--accent-sage)' : '#B45309'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600 }}>
                {isFreeShipping ? '🎉 Free Pan-India Delivery Unlocked!' : `Add ${settings.currency}${(freeShippingThreshold - subtotal).toFixed(2)} more for FREE shipping`}
              </span>
              <span>{Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100))}%</span>
            </div>
            <div style={{
              height: '6px',
              width: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.08)',
              borderRadius: '999px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, (subtotal / freeShippingThreshold) * 100)}%`,
                backgroundColor: isFreeShipping ? 'var(--accent-sage)' : 'var(--accent-terracotta)',
                transition: 'width 0.4s ease'
              }} />
            </div>
          </div>
        )}

        {/* Drawer Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px'
        }}>
          {orderComplete ? (
            /* Order Placed Success View */
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              height: '100%',
              padding: '20px 10px'
            }}>
              <div style={{
                width: '74px',
                height: '74px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-sage-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-sage)',
                marginBottom: '18px'
              }}>
                <CheckCircle2 size={42} />
              </div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px' }}>
                Order #{orderComplete.id} Confirmed!
              </h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6, maxWidth: '380px' }}>
                Thank you, <strong>{orderComplete.customerName}</strong>! Your order has been registered in our database. Deepa has started prepping your yarns and floral stitches!
              </p>

              {/* Action Buttons: Track + Invoice */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '320px' }}>
                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    setIsTrackingModalOpen(true);
                  }}
                  className="btn-primary"
                  style={{ width: '100%', padding: '12px', fontSize: '0.9rem' }}
                >
                  <Truck size={16} />
                  <span>Track Parcel Progress</span>
                </button>

                <button
                  onClick={() => {
                    setActiveInvoiceOrder(orderComplete);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '12px',
                    borderRadius: 'var(--radius-full)',
                    border: '1.5px solid var(--accent-terracotta)',
                    backgroundColor: '#FFFFFF',
                    color: 'var(--accent-terracotta)',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  <FileText size={16} />
                  <span>View / Print Tax Invoice</span>
                </button>

                <button
                  onClick={() => {
                    setOrderComplete(null);
                    setIsCartOpen(false);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginTop: '8px'
                  }}
                >
                  ← Back to Store
                </button>
              </div>
            </div>
          ) : isCheckingOut ? (
            /* Multi-Gateway Production Checkout View */
            <form onSubmit={handleCheckoutSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Shipping & Payment Details
                </h4>
                <button
                  type="button"
                  onClick={() => setIsCheckingOut(false)}
                  style={{ fontSize: '0.8rem', color: 'var(--accent-terracotta)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  ← Back to Bag
                </button>
              </div>

              {/* Customer Inputs */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pooja Sharma"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-medium)',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px' }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@gmail.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-medium)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px' }}>
                    Mobile Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-medium)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px' }}>
                  Complete Delivery Address *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Flat/House No., Street, Landmark, City, State & Pincode"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-medium)',
                    fontSize: '0.88rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* Payment Method Selector */}
              <div style={{ marginTop: '6px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                  Choose Payment Method:
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Option 1: Instant UPI QR & Apps */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: paymentMethod === 'upi' ? '2px solid var(--accent-terracotta)' : '1px solid var(--border-medium)',
                    backgroundColor: paymentMethod === 'upi' ? 'var(--accent-terracotta-light)' : '#FFFFFF',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="upi"
                      checked={paymentMethod === 'upi'}
                      onChange={() => setPaymentMethod('upi')}
                    />
                    <QrCode size={18} color="var(--accent-terracotta)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                        Instant UPI QR (GPay / PhonePe / Paytm / BHIM)
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Scan & pay directly to store UPI ID without gateway fees
                      </div>
                    </div>
                  </label>

                  {/* Option 2: Razorpay Gateway */}
                  {settings.paymentRazorpayEnabled && (
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: paymentMethod === 'razorpay' ? '2px solid var(--accent-terracotta)' : '1px solid var(--border-medium)',
                      backgroundColor: paymentMethod === 'razorpay' ? 'var(--accent-terracotta-light)' : '#FFFFFF',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="razorpay"
                        checked={paymentMethod === 'razorpay'}
                        onChange={() => setPaymentMethod('razorpay')}
                      />
                      <CreditCard size={18} color="#2563EB" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                          Razorpay Secure Gateway
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Credit/Debit Cards, NetBanking, Wallets
                        </div>
                      </div>
                    </label>
                  )}

                  {/* Option 3: Cash on Delivery (COD) */}
                  {settings.paymentCodEnabled !== false && (
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: paymentMethod === 'cod' ? '2px solid var(--accent-terracotta)' : '1px solid var(--border-medium)',
                      backgroundColor: paymentMethod === 'cod' ? 'var(--accent-terracotta-light)' : '#FFFFFF',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="cod"
                        checked={paymentMethod === 'cod'}
                        onChange={() => setPaymentMethod('cod')}
                      />
                      <Truck size={18} color="#16A34A" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                          Cash on Delivery (COD)
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Pay with cash upon parcel delivery at your doorstep
                        </div>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* UPI QR Display Card */}
              {paymentMethod === 'upi' && (
                <div style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: '16px',
                  border: '1px solid #CBD5E1',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E293B', marginBottom: '8px' }}>
                    Scan to Pay {settings.currency}{total.toFixed(2)}
                  </div>

                  {upiQrDataUrl ? (
                    <img
                      src={upiQrDataUrl}
                      alt="UPI QR Code"
                      style={{
                        width: '180px',
                        height: '180px',
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                        backgroundColor: '#FFFFFF',
                        padding: '6px'
                      }}
                    />
                  ) : (
                    <div style={{ width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      Generating QR...
                    </div>
                  )}

                  <div style={{ marginTop: '8px', fontSize: '0.76rem', color: '#475569' }}>
                    UPI ID: <strong>{settings.upiId || 'cozyloops@upi'}</strong>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                    Payee: {settings.upiPayeeName || 'Deepa Soni'}
                  </div>

                  <div style={{ width: '100%', marginTop: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#334155', textAlign: 'left', marginBottom: '4px' }}>
                      12-Digit UPI Ref / UTR No. (Optional for faster verification)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 429182749102"
                      value={upiUtrNumber}
                      onChange={(e) => setUpiUtrNumber(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.82rem'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Total & Submit Button */}
              <div style={{
                borderTop: '1px solid var(--border-medium)',
                paddingTop: '14px',
                marginTop: '4px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Payable Total:</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-terracotta)' }}>
                    {settings.currency}{total.toFixed(2)}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary"
                  style={{ width: '100%', padding: '14px', fontSize: '0.96rem' }}
                >
                  <ShieldCheck size={18} />
                  <span>
                    {isSubmitting
                      ? 'Processing Order...'
                      : paymentMethod === 'razorpay'
                      ? 'Pay with Razorpay'
                      : paymentMethod === 'upi'
                      ? 'Confirm UPI Order'
                      : 'Confirm Cash on Delivery Order'}
                  </span>
                </button>
              </div>
            </form>
          ) : cart.length === 0 ? (
            /* Empty Cart View */
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              height: '100%',
              padding: '40px 10px'
            }}>
              <span style={{ fontSize: '3rem', marginBottom: '14px' }}>🧶</span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>
                Your craft bag is empty
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                Explore our hand-stitched floral scrunchies, sunny clips, and ponytail holders.
              </p>
              <button
                onClick={() => setIsCartOpen(false)}
                className="btn-secondary"
              >
                <span>Browse Collection</span>
              </button>
            </div>
          ) : (
            /* Cart Items List */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {cart.map(item => (
                <div
                  key={item.product.id}
                  style={{
                    display: 'flex',
                    gap: '14px',
                    padding: '12px',
                    borderRadius: '14px',
                    border: '1px solid var(--border-light)',
                    backgroundColor: '#FFFFFF',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <img
                    src={item.product.image}
                    alt={item.product.title}
                    style={{
                      width: '74px',
                      height: '74px',
                      borderRadius: '10px',
                      objectFit: 'cover',
                      backgroundColor: 'var(--bg-surface-soft)'
                    }}
                  />

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.3, margin: 0 }}>
                          {item.product.title}
                        </h4>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          style={{ color: 'var(--text-subtle)', padding: '2px', cursor: 'pointer', background: 'none', border: 'none' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <p style={{ fontSize: '0.74rem', color: 'var(--accent-sage)', fontWeight: 600, margin: '2px 0 0' }}>
                        {item.product.category}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        border: '1px solid var(--border-medium)',
                        borderRadius: '999px',
                        padding: '2px'
                      }}>
                        <button
                          onClick={() => updateCartQuantity(item.product.id, -1)}
                          style={{ width: '24px', height: '24px', borderRadius: '50%', fontWeight: 700, border: 'none', background: 'transparent', cursor: 'pointer' }}
                        >
                          -
                        </button>
                        <span style={{ padding: '0 10px', fontSize: '0.85rem', fontWeight: 700 }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateCartQuantity(item.product.id, 1)}
                          style={{ width: '24px', height: '24px', borderRadius: '50%', fontWeight: 700, border: 'none', background: 'transparent', cursor: 'pointer' }}
                        >
                          +
                        </button>
                      </div>

                      <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--accent-terracotta)' }}>
                        {settings.currency}{(item.product.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drawer Footer with Promo applicator and Checkout button */}
        {cart.length > 0 && !orderComplete && !isCheckingOut && (
          <div style={{
            padding: '20px 24px',
            borderTop: '1px solid var(--border-medium)',
            backgroundColor: '#FAF7F2'
          }}>
            {/* Promo Code Input */}
            <form onSubmit={handleApplyPromo} style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Promo code (e.g. WELCOME20)"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-medium)',
                    fontSize: '0.82rem',
                    textTransform: 'uppercase'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--accent-terracotta)',
                    color: '#FFFFFF',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Apply
                </button>
              </div>
              {promoError && (
                <p style={{ fontSize: '0.72rem', color: '#DC2626', marginTop: '4px' }}>
                  {promoError}
                </p>
              )}
            </form>

            {/* Active promo badge */}
            {activePromo && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--accent-sage-light)',
                color: 'var(--accent-sage)',
                fontSize: '0.78rem',
                fontWeight: 600,
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Tag size={13} />
                  <span>Promo {activePromo.code} Applied</span>
                </div>
                <button
                  onClick={removePromoCode}
                  style={{ fontSize: '0.74rem', color: '#DC2626', fontWeight: 700, border: 'none', background: 'none', cursor: 'pointer' }}
                >
                  Remove
                </button>
              </div>
            )}

            {/* Calculations Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.86rem', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>Subtotal</span>
                <span>{settings.currency}{subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-rose)', fontWeight: 600 }}>
                  <span>Discount</span>
                  <span>-{settings.currency}{discount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>Pan-India Shipping</span>
                <span>{shippingCost === 0 ? 'FREE' : `${settings.currency}${shippingCost.toFixed(2)}`}</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '1.15rem',
                fontWeight: 800,
                color: 'var(--text-main)',
                paddingTop: '8px',
                borderTop: '1px solid var(--border-medium)'
              }}>
                <span>Total</span>
                <span style={{ color: 'var(--accent-terracotta)' }}>{settings.currency}{total.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => setIsCheckingOut(true)}
              className="btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '0.96rem' }}
            >
              <span>Proceed to Checkout</span>
              <ArrowRight size={16} />
            </button>

            {/* WhatsApp Order Button */}
            {settings.contactPhone && (
              <a
                href={(() => {
                  const phone = settings.contactPhone.replace(/\D/g, '');
                  const itemLines = cart.map(i => `• ${i.product.title} x${i.quantity} — ${settings.currency}${(i.product.price * i.quantity).toFixed(2)}`).join('\n');
                  const promoLine = activePromo ? `\nPromo Applied: ${activePromo.code} (-${settings.currency}${discount.toFixed(2)})` : '';
                  const msg = `Hi Deepa! 🌸 I'd like to order handcrafted pieces from *${settings.storeName}*:\n\n${itemLines}${promoLine}\n\n*Total: ${settings.currency}${total.toFixed(2)}*\n\nPlease confirm availability and payment details. Thank you! 🧶`;
                  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
                })()}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '12px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: '#25D366',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  textDecoration: 'none',
                  marginTop: '10px',
                  boxShadow: '0 4px 14px rgba(37, 211, 102, 0.3)',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span>Order via WhatsApp</span>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

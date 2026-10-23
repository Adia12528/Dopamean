import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { useUser } from '../../context/UserContext';
import { api, getAssetUrl } from '../../services/api';
import type { DeliveryChargeQuote, Order } from '../../types';
import { getShortOrderId } from '../../lib/shortOrderId';
import { calculateDeliveryCharge, extractIndianPincode, removeTrailingIndianPincode } from '../../lib/deliveryPricing';
import { 
  X, 
  Trash2, 
  ShoppingBag, 
  ArrowRight, 
  Tag, 
  CheckCircle2, 
  Clock,
  CreditCard, 
  QrCode, 
  Truck, 
  ShieldCheck,
  Download,
  Copy,
  Check,
  Smartphone,
  Landmark,
  AlertCircle
} from 'lucide-react';
import { downloadInvoicePDF } from '../../utils/downloadInvoicePdf';
import { createWhatsAppUrl, getWhatsAppTemplate, isWhatsAppEnabled, isWhatsAppSupportEnabled, renderWhatsAppTemplate } from '../../lib/whatsapp';
import { isCartCodEligible, isProductCodEligible } from '../../lib/codPolicy';
import { StorePolicyDialog, type StorePolicyKey } from './StorePolicyDialog';
import { StorefrontImage } from '../common/StorefrontImage';
import { forgetPendingPayment, getPendingPaymentReferences, rememberPendingPayment } from '../../lib/paymentRecovery';
import {
  clearDirectUpiRecoveryDraft,
  createDirectUpiCheckoutReference,
  DIRECT_UPI_RECOVERY_RESUME_EVENT,
  getDirectUpiCartSignature,
  readDirectUpiRecoveryDraft,
  saveDirectUpiRecoveryDraft
} from '../../lib/directUpiRecovery';
import { useBackNavigationBlocker, useBackNavigationLayer } from '../../context/BackNavigationContext';

const isValidUpiVpa = (value?: string) =>
  Boolean(value && /^[A-Za-z0-9][A-Za-z0-9._-]{1,255}@[A-Za-z][A-Za-z0-9.-]{1,63}$/.test(value.trim()));

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
  modal?: { ondismiss?: () => void };
  on?: (event: 'payment.failed', handler: (response: { error?: { description?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: {
      new (options: RazorpayOptions): {
        open: () => void;
        on: (event: 'payment.failed', handler: (response: { error?: { description?: string } }) => void) => void;
      };
    };
  }
}

export const CartDrawer: React.FC = () => {
  const {
    currentUser,
    userToken,
    isUserLoggedIn,
    isLoadingUser,
    openUserAuthModal,
    updateUserProfile
  } = useUser();
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
    syncOrder,
    clearCart,
    settings,
    setIsTrackingModalOpen,
    showToast
  } = useStore();

  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'address' | 'payment'>('address');
  const [addressErrors, setAddressErrors] = useState<Partial<Record<'name' | 'email' | 'phone' | 'address' | 'pincode', string>>>({});
  const [distanceQuoteState, setDistanceQuoteState] = useState<{
    requestKey: string;
    quote: DeliveryChargeQuote;
    usesZoneFallback: boolean;
  } | null>(null);
  const [distanceQuoteError, setDistanceQuoteError] = useState('');
  const [distanceQuoteRetry, setDistanceQuoteRetry] = useState(0);
  const [orderComplete, setOrderComplete] = useState<Order | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const [invoiceDownloadError, setInvoiceDownloadError] = useState('');
  const [paymentIssue, setPaymentIssue] = useState<{
    orderId: string;
    method: 'razorpay' | 'payu';
    state: 'checking' | 'pending' | 'failed' | 'unavailable';
    message?: string;
    createdAt: number;
  } | null>(null);
  const [paymentStatusRefresh, setPaymentStatusRefresh] = useState(0);
  const [isGatewayCheckoutOpen, setIsGatewayCheckoutOpen] = useState(false);
  const isPaymentStatusCheckInProgress = useRef(false);
  const upiProofFileInputRef = useRef<HTMLInputElement>(null);

  // Payment method selection
  const [selectedPaymentMethod, setPaymentMethod] = useState<'upi' | 'razorpay' | 'payu' | 'cod'>(() =>
    settings.paymentUpiEnabled !== false && isValidUpiVpa(settings.upiId) && Boolean(settings.upiQrImage) ? 'upi'
      : settings.paymentRazorpayEnabled ? 'razorpay'
        : settings.paymentPayuEnabled && settings.payuConfigured ? 'payu'
          : 'cod'
  );
  const [upiUtrNumber, setUpiUtrNumber] = useState('');
  const [upiUtrError, setUpiUtrError] = useState('');
  const [upiProofFile, setUpiProofFile] = useState<File | null>(null);
  const [isUpiConfirmationOpen, setIsUpiConfirmationOpen] = useState(false);
  const [upiCheckoutReference, setUpiCheckoutReference] = useState('');
  const [hasAcceptedStorePolicies, setHasAcceptedStorePolicies] = useState(false);
  const [hasConfirmedUpiDetails, setHasConfirmedUpiDetails] = useState(false);
  const [activeStorePolicy, setActiveStorePolicy] = useState<StorePolicyKey | null>(null);
  const [hasCopiedUpiId, setHasCopiedUpiId] = useState(false);
  const isPaymentNavigationProtected = isGatewayCheckoutOpen ||
    isUpiConfirmationOpen ||
    (isSubmitting && (selectedPaymentMethod === 'razorpay' || selectedPaymentMethod === 'payu')) ||
    paymentIssue?.state === 'checking';
  useBackNavigationBlocker('cart-payment-flow', isPaymentNavigationProtected);
  useBackNavigationLayer('cart-drawer', isCartOpen, () => {
    setIsCartOpen(false);
    setOrderComplete(null);
    setIsCheckingOut(false);
  });
  useBackNavigationLayer('cart-checkout', isCartOpen && isCheckingOut, () => {
    setIsCheckingOut(false);
    setCheckoutStep('address');
  });
  useBackNavigationLayer('cart-checkout-payment-step', isCartOpen && isCheckingOut && checkoutStep === 'payment', () => {
    setCheckoutStep('address');
  });
  useBackNavigationLayer('cart-order-complete', isCartOpen && Boolean(orderComplete), () => setOrderComplete(null));

  const [formOverrides, setFormOverrides] = useState<{
    name?: string;
    phone?: string;
    address?: string;
    pincode?: string;
  }>({});
  const draftStorageWarningShown = useRef(false);
  const savedProfileAddress = [currentUser?.address, currentUser?.city]
    .filter(value => value?.trim())
    .join(', ');
  const savedProfilePincode = currentUser?.pincode?.trim() && /^[1-9]\d{5}$/.test(currentUser.pincode.trim())
    ? currentUser.pincode.trim()
    : extractIndianPincode([savedProfileAddress, currentUser?.pincode].filter(Boolean).join(', '));
  const profileAddress = removeTrailingIndianPincode(savedProfileAddress, savedProfilePincode);
  const formData = {
    name: formOverrides.name ?? currentUser?.name ?? '',
    email: currentUser?.email ?? '',
    phone: formOverrides.phone ?? currentUser?.phone ?? '',
    address: formOverrides.address ?? profileAddress,
    pincode: formOverrides.pincode ?? savedProfilePincode
  };
  const clearCheckoutDraft = useCallback(() => {
    try {
      sessionStorage.removeItem('dopamean_checkout_draft');
    } catch (error) {
      console.error('Could not clear the session checkout draft:', error);
    }
  }, []);

  const beginDirectUpiRecovery = () => {
    const email = currentUser?.email?.trim().toLowerCase() || '';
    const cartSignature = getDirectUpiCartSignature(cart);
    const existingDraft = readDirectUpiRecoveryDraft();
    const draft = existingDraft?.email.toLowerCase() === email && existingDraft.cartSignature === cartSignature
      ? existingDraft
      : { email, cartSignature, reference: createDirectUpiCheckoutReference(), createdAt: Date.now() };

    if (email && !saveDirectUpiRecoveryDraft(draft)) {
      showToast('This browser could not save UPI checkout recovery. Keep this checkout open until you submit your UTR.', 'error');
    }
    setUpiCheckoutReference(draft.reference);
    return draft.reference;
  };

  useEffect(() => {
    const resumeDirectUpiCheckout = () => {
      const draft = readDirectUpiRecoveryDraft();
      setUpiCheckoutReference(draft?.reference || '');
      setIsCheckingOut(true);
      setCheckoutStep('payment');
      setPaymentMethod('upi');
      setIsUpiConfirmationOpen(true);
    };
    window.addEventListener(DIRECT_UPI_RECOVERY_RESUME_EVENT, resumeDirectUpiCheckout);
    return () => window.removeEventListener(DIRECT_UPI_RECOVERY_RESUME_EVENT, resumeDirectUpiCheckout);
  }, []);

  useEffect(() => {
    if (!currentUser?.email) return;
    try {
      const stored = sessionStorage.getItem('dopamean_checkout_draft');
      if (!stored) return;
      const draft: { email?: string; name?: string; phone?: string; address?: string; pincode?: string } = JSON.parse(stored);
      if (draft.email?.toLowerCase() === currentUser.email.toLowerCase()) {
        setFormOverrides(previous => ({
          ...previous,
          name: draft.name,
          phone: draft.phone,
          address: draft.address,
          pincode: draft.pincode || extractIndianPincode(draft.address || '') || savedProfilePincode
        }));
      } else {
        sessionStorage.removeItem('dopamean_checkout_draft');
      }
    } catch (error) {
      console.error('Could not restore the session checkout draft:', error);
      if (!draftStorageWarningShown.current) {
        showToast('Saved delivery edits could not be restored. Please review your address before payment.', 'error');
        draftStorageWarningShown.current = true;
      }
    }
  }, [currentUser?.email, savedProfilePincode, showToast]);

  useEffect(() => {
    if (!currentUser?.email || !Object.values(formOverrides).some(value => value?.trim())) return;
    try {
      sessionStorage.setItem('dopamean_checkout_draft', JSON.stringify({
        email: currentUser.email,
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        pincode: formData.pincode
      }));
      draftStorageWarningShown.current = false;
    } catch (error) {
      console.error('Could not save the session checkout draft:', error);
      if (!draftStorageWarningShown.current) {
        showToast('Your delivery edits could not be saved for recovery. Keep this checkout open while completing payment.', 'error');
        draftStorageWarningShown.current = true;
      }
    }
  }, [currentUser?.email, formData.address, formData.name, formData.phone, formData.pincode, formOverrides, showToast]);
  const isOrderPaymentConfirmed = orderComplete?.paymentStatus === 'paid';

  const subtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);

  let discount = 0;
  if (activePromo) {
    if (activePromo.discountType === 'percentage') {
      discount = (subtotal * activePromo.discountValue) / 100;
    } else {
      discount = Math.min(activePromo.discountValue, subtotal);
    }
  }

  const freeShippingThreshold = settings.freeShippingThreshold ?? 299;
  const isDistancePricingEnabled = settings.deliveryDistancePricing?.enabled === true;
  const hasPincodeOverride = settings.deliveryPricing?.pincodeOverrides?.some(
    override => override.pincode === formData.pincode
  ) === true;
  const requiresDistanceQuote = isDistancePricingEnabled &&
    subtotal > 0 &&
    subtotal < freeShippingThreshold &&
    /^[1-9]\d{5}$/.test(formData.pincode) &&
    !hasPincodeOverride;
  const distancePricingSettingsKey = JSON.stringify([
    settings.deliveryDistancePricing ?? null,
    settings.deliveryPricing?.fallback ?? null,
    settings.deliveryPricing?.zones ?? null,
    settings.deliveryPricing?.pincodeOverrides ?? null,
    settings.shippingFee,
    freeShippingThreshold
  ]);
  const distanceQuoteRequestKey = `${formData.pincode}:${subtotal}:${distancePricingSettingsKey}`;
  const currentDistanceQuote = distanceQuoteState?.requestKey === distanceQuoteRequestKey
    ? distanceQuoteState.quote
    : null;
  const isUsingZoneFallback = distanceQuoteState?.requestKey === distanceQuoteRequestKey &&
    distanceQuoteState.usesZoneFallback;
  const isDistanceQuoteReady = !requiresDistanceQuote || currentDistanceQuote !== null;
  const zoneDeliveryQuote = useMemo(
    () => calculateDeliveryCharge(settings, formData.pincode, subtotal),
    [settings, formData.pincode, subtotal]
  );
  const deliveryQuote: DeliveryChargeQuote = requiresDistanceQuote
    ? currentDistanceQuote ?? {
      ...zoneDeliveryQuote,
      zoneName: 'Distance-based delivery',
      pricingMode: 'distance' as const
    }
    : zoneDeliveryQuote;
  useEffect(() => {
    if (!requiresDistanceQuote) {
      setDistanceQuoteState(null);
      setDistanceQuoteError('');
      return;
    }

    const controller = new AbortController();
    setDistanceQuoteState(null);
    setDistanceQuoteError('');
    const timeout = setTimeout(() => {
      void api.getDeliveryQuote(formData.pincode, subtotal, controller.signal)
        .then(quote => {
          if (!controller.signal.aborted) {
            setDistanceQuoteState({
              requestKey: distanceQuoteRequestKey,
              quote: quote ?? zoneDeliveryQuote,
              usesZoneFallback: quote === null
            });
          }
        })
        .catch(error => {
          if (!controller.signal.aborted) {
            setDistanceQuoteError(error instanceof Error ? error.message : 'Could not calculate the delivery charge.');
          }
        });
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [distanceQuoteRequestKey, distanceQuoteRetry, formData.pincode, requiresDistanceQuote, subtotal, zoneDeliveryQuote]);
  const isFreeShipping = deliveryQuote.isFreeShipping;
  const shippingCost = deliveryQuote.amount;
  const total = Math.max(0, subtotal - discount + shippingCost);
  const upiId = settings.upiId?.trim() || '';
  const isAndroidDevice = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  const isIosDevice = typeof navigator !== 'undefined' && (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
  const isMobileDevice = isAndroidDevice || isIosDevice;
  const createUpiPaymentLink = (checkoutReference: string) => {
    const storeName = settings.storeName || 'Cozy Loops by Deepa';
    const payeeName = settings.upiPayeeName?.trim() || storeName;
    const transactionReference = checkoutReference.replace(/[^A-Za-z0-9]/g, '');
    const parameters = new URLSearchParams({
      pa: upiId,
      pn: payeeName,
      am: total.toFixed(2),
      cu: 'INR',
      tr: transactionReference,
      tn: `${storeName} ${checkoutReference}`
    });
    return `upi://pay?${parameters.toString()}`;
  };
  const hasValidUpiId = settings.paymentUpiEnabled !== false && isValidUpiVpa(upiId) && Boolean(settings.upiQrImage?.trim());
  const codUnavailableProducts = cart
    .filter(item => !isProductCodEligible(item.product, settings.codRules || []))
    .map(item => ({
      id: item.product.id,
      name: item.product.title,
      category: item.product.category
    }));
  const isCodAvailableForCart = isCartCodEligible(cart.map(item => item.product), settings);
  const availablePaymentMethods = [
    ...(hasValidUpiId ? ['upi' as const] : []),
    ...(settings.paymentRazorpayEnabled ? ['razorpay' as const] : []),
    ...(settings.paymentPayuEnabled && settings.payuConfigured ? ['payu' as const] : []),
    ...(isCodAvailableForCart ? ['cod' as const] : [])
  ];
  const nonCodPaymentLabels = availablePaymentMethods
    .filter(method => method !== 'cod')
    .map(method => ({
      upi: 'UPI Direct',
      razorpay: 'Razorpay',
      payu: 'PayU'
    })[method]);
  const paymentMethod = availablePaymentMethods.includes(selectedPaymentMethod)
    ? selectedPaymentMethod
    : availablePaymentMethods[0] || 'cod';
  const whatsappOrderUrl = (() => {
    if (!isWhatsAppEnabled(settings) || settings.whatsappOrderButtonEnabled === false) return null;
    const phone = settings.whatsappBusinessPhone || settings.contactPhone || '';
    const itemLines = cart.map(item =>
      `• ${item.product.title} x${item.quantity} — ${settings.currency}${(item.product.price * item.quantity).toFixed(2)}`
    ).join('\n');
    const promo = activePromo ? `\nPromo Applied: ${activePromo.code} (-${settings.currency}${discount.toFixed(2)})\n` : '';
    const message = renderWhatsAppTemplate(getWhatsAppTemplate(settings, 'orderInquiry'), {
      store: settings.storeName || 'our store',
      items: itemLines,
      promo,
      currency: settings.currency || '₹',
      total: total.toFixed(2)
    });
    return createWhatsAppUrl(phone, message, settings.whatsappCountryCode || '91');
  })();
  const paymentSupportUrl = paymentIssue && isWhatsAppSupportEnabled(settings)
    ? createWhatsAppUrl(
      settings.whatsappBusinessPhone || settings.contactPhone || '',
      renderWhatsAppTemplate(getWhatsAppTemplate(settings, 'support'), { orderId: paymentIssue.orderId }),
      settings.whatsappCountryCode || '91'
    )
    : null;

  const paymentIssueOrderId = paymentIssue?.orderId;

  useEffect(() => {
    if (!paymentIssueOrderId || !formData.email) return;
    let active = true;
    const checkPaymentStatus = async () => {
      if (isPaymentStatusCheckInProgress.current) return;
      isPaymentStatusCheckInProgress.current = true;
      if (!navigator.onLine) {
        setPaymentIssue(previous => previous ? { ...previous, state: 'checking' } : null);
        isPaymentStatusCheckInProgress.current = false;
        return;
      }
      try {
        const orders = await api.trackOrder(paymentIssueOrderId, formData.email);
        const order = orders.find(candidate => candidate.id === paymentIssueOrderId);
        if (!active) return;
        if (order?.paymentStatus === 'paid') {
          try {
            forgetPendingPayment(paymentIssueOrderId);
          } catch (error) {
            console.error('Could not clear resolved payment recovery details:', error);
            showToast('Payment is confirmed, but this device could not clear its saved recovery reminder.', 'error');
          }
          syncOrder(order);
          clearCheckoutDraft();
          clearCart();
          setOrderComplete(order);
          setIsCheckingOut(false);
          setPaymentIssue(null);
          return;
        }
        if (order?.paymentStatus === 'failed' || order?.status === 'cancelled') {
          try {
            forgetPendingPayment(paymentIssueOrderId);
          } catch (error) {
            console.error('Could not clear failed payment recovery details:', error);
          }
          if (order) syncOrder(order);
          setPaymentIssue(previous => previous ? {
            ...previous,
            state: 'failed',
            message: previous.message || 'The payment was not completed. Your cart and delivery details are still saved.'
          } : null);
          return;
        }
        setPaymentIssue(previous => previous ? { ...previous, state: 'pending' } : null);
      } catch (error) {
        if (!active) return;
        setPaymentIssue(previous => previous ? {
          ...previous,
          state: 'unavailable',
          message: error instanceof Error
            ? 'We could not reach order tracking. We will check again when your connection is available.'
            : 'We could not reach order tracking. Your cart and order reference are saved.'
        } : null);
      } finally {
        isPaymentStatusCheckInProgress.current = false;
      }
    };

    void checkPaymentStatus();
    const interval = window.setInterval(() => { void checkPaymentStatus(); }, 15000);
    window.addEventListener('online', checkPaymentStatus);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('online', checkPaymentStatus);
    };
  }, [paymentIssueOrderId, formData.email, clearCart, clearCheckoutDraft, showToast, syncOrder, paymentStatusRefresh]);

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoInput.trim()) return;
    if (promoInput.trim().toUpperCase() === 'OFFSPRING') {
      setPromoError('This promotional code is not valid.');
      return;
    }
    const res = applyPromoCode(promoInput);
    if (!res.success) {
      setPromoError(res.message);
    } else {
      setPromoError('');
      setPromoInput('');
    }
  };

  const handleCopyUpiId = async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      setHasCopiedUpiId(true);
      window.setTimeout(() => setHasCopiedUpiId(false), 1800);
      showToast('UPI ID copied. Open your UPI app and pay manually.', 'success');
    } catch (error) {
      console.error('Could not copy UPI ID:', error);
      showToast('Copy was blocked by your browser. Select the UPI ID and copy it manually.', 'error');
    }
  };

  const handleUpiProofSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] || null;
    event.currentTarget.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      showToast('Choose a PNG, JPG, GIF, or WebP payment screenshot.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('The payment screenshot must be 5 MB or smaller.', 'error');
      return;
    }
    setUpiProofFile(file);
  };

  const handleSafelyRetryPayment = async () => {
    if (!paymentIssue || paymentIssue.method !== 'razorpay' || !userToken) return;
    setIsSubmitting(true);
    try {
      const order = await api.cancelRazorpayOrder(paymentIssue.orderId, userToken);
      syncOrder(order);
      if (order.paymentStatus === 'paid') {
        clearCheckoutDraft();
        clearCart();
        setOrderComplete(order);
        setIsCheckingOut(false);
        setPaymentIssue(null);
        return;
      }
      if (order.status !== 'cancelled' && order.paymentStatus !== 'failed') {
        setPaymentIssue(previous => previous ? {
          ...previous,
          state: 'pending',
          message: 'The earlier payment is not safely closed yet. We will not start another payment until its status changes.'
        } : null);
        return;
      }
      try {
        forgetPendingPayment(paymentIssue.orderId);
      } catch (storageError) {
        console.error('Could not clear the resolved Razorpay reference:', storageError);
      }
      setPaymentIssue(null);
      setCheckoutStep('payment');
      setIsCheckingOut(true);
    } catch (error) {
      console.error('Could not safely release the previous Razorpay attempt:', error);
      try {
        const orders = await api.trackOrder(paymentIssue.orderId, formData.email);
        const order = orders.find(candidate => candidate.id === paymentIssue.orderId);
        if (order?.paymentStatus === 'paid') {
          syncOrder(order);
          try {
            forgetPendingPayment(paymentIssue.orderId);
          } catch (storageError) {
            console.error('Could not clear the confirmed Razorpay reference:', storageError);
          }
          clearCheckoutDraft();
          clearCart();
          setOrderComplete(order);
          setIsCheckingOut(false);
          setPaymentIssue(null);
          return;
        }
        if (order?.paymentStatus === 'failed' || order?.status === 'cancelled') {
          try {
            forgetPendingPayment(paymentIssue.orderId);
          } catch (storageError) {
            console.error('Could not clear the cancelled Razorpay reference:', storageError);
          }
          setPaymentIssue(null);
          setCheckoutStep('payment');
          setIsCheckingOut(true);
          return;
        }
      } catch (statusError) {
        console.error('Could not refresh payment status after retry was blocked:', statusError);
      }
      setPaymentIssue(previous => previous ? {
        ...previous,
        state: 'pending',
        message: error instanceof Error
          ? `${error.message} We will not start another payment while this one is unresolved.`
          : 'We could not safely release this payment attempt. Check its status before trying again.'
      } : null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerCelebration = async () => {
    try {
      const { default: confetti } = await import('canvas-confetti');
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (error) {
      console.warn('Could not load checkout celebration effect:', error);
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checkoutStep === 'address') {
      const errors: typeof addressErrors = {};
      if (!formData.name.trim()) errors.name = 'Enter your full name.';
      if (!formData.email.trim()) errors.email = 'Your signed-in account email is required.';
      if (!formData.phone.trim()) errors.phone = 'Enter a mobile phone number.';
      if (!formData.address.trim()) errors.address = 'Enter your complete delivery address.';
      if (!/^[1-9]\d{5}$/.test(formData.pincode)) errors.pincode = 'Enter a valid six-digit Indian pincode.';
      setAddressErrors(errors);
      if (Object.keys(errors).length > 0) return;
      if (requiresDistanceQuote && !isDistanceQuoteReady) {
        showToast(
          distanceQuoteError
            ? `Delivery charge unavailable: ${distanceQuoteError}`
            : 'Calculating the distance-based delivery charge. Please wait and try again.',
          'error'
        );
        return;
      }
      if (currentUser && (
        formData.address.trim() !== profileAddress ||
        formData.pincode !== savedProfilePincode
      )) {
        try {
          await updateUserProfile({
            address: formData.address.trim(),
            city: '',
            pincode: formData.pincode
          });
        } catch (error) {
          console.error('Could not save the delivery address to the customer profile:', error);
          showToast('Your order can continue, but we could not save this address to your profile. You can save it under My Profile.', 'error');
        }
      }
      if (paymentMethod === 'upi') beginDirectUpiRecovery();
      setCheckoutStep('payment');
      return;
    }
    if (!hasAcceptedStorePolicies) {
      showToast('Please agree to the store policies before placing your order.', 'error');
      return;
    }
    if (!isUserLoggedIn || !userToken) {
      showToast('Sign in to your account before placing an order.', 'error');
      setIsCheckingOut(false);
      openUserAuthModal('signin');
      return;
    }
    if (!formData.name || !formData.email || !formData.phone || !formData.address || !/^[1-9]\d{5}$/.test(formData.pincode)) return;
    if (requiresDistanceQuote && !isDistanceQuoteReady) {
      showToast(
        distanceQuoteError
          ? `Delivery charge unavailable: ${distanceQuoteError}`
          : 'Calculating the distance-based delivery charge. Please wait and try again.',
        'error'
      );
      return;
    }
    if (availablePaymentMethods.length === 0) {
      showToast('Online payment is not configured yet. Please contact the store or try again later.', 'error');
      return;
    }
    if (paymentMethod === 'upi' && !isUpiConfirmationOpen) {
      setIsUpiConfirmationOpen(true);
      return;
    }
    if (paymentMethod === 'upi' && !hasConfirmedUpiDetails) {
      showToast('Confirm that your payment details are accurate before submitting.', 'error');
      return;
    }
    if (paymentMethod === 'upi' && !/^\d{12}$/.test(upiUtrNumber)) {
      setUpiUtrError('Enter the 12-digit UTR shown in your UPI app.');
      return;
    }

    const authenticatedUserToken = userToken;
    const policyConsent = {
      accepted: true as const,
      policyVersion: Number(settings.storePolicyVersion) || 1
    };
    try {
      const references = getPendingPaymentReferences();
      for (const reference of references) {
        let orders: Order[];
        try {
          orders = await api.trackOrder(reference.orderId, formData.email);
        } catch {
          setPaymentIssue({
            orderId: reference.orderId,
            method: reference.paymentMethod,
            state: 'unavailable',
            message: 'We could not confirm an earlier payment. Check its status before placing another order.',
            createdAt: reference.createdAt
          });
          return;
        }
        const existingOrder = orders.find(order => order.id === reference.orderId);
        if (!existingOrder) {
          setPaymentIssue({
            orderId: reference.orderId,
            method: reference.paymentMethod,
            state: 'unavailable',
            message: 'We could not find the earlier order for this account. Check its reference before placing another order.',
            createdAt: reference.createdAt
          });
          return;
        }
        if (existingOrder.paymentStatus === 'paid') {
          forgetPendingPayment(reference.orderId);
          syncOrder(existingOrder);
          clearCheckoutDraft();
          clearCart();
          setOrderComplete(existingOrder);
          setIsCheckingOut(false);
          return;
        }
        if (existingOrder.paymentStatus === 'failed' || existingOrder.status === 'cancelled') {
          forgetPendingPayment(reference.orderId);
          continue;
        }
        setPaymentIssue({
          orderId: reference.orderId,
          method: reference.paymentMethod,
          state: 'pending',
          message: 'An earlier payment is still awaiting confirmation. We will not start another payment until its status is clear.',
          createdAt: reference.createdAt
        });
        return;
      }
    } catch (error) {
      console.error('Could not check saved payment references:', error);
      showToast('Could not check a previous payment. Please check your order status before trying again.', 'error');
      return;
    }

    setIsSubmitting(true);
    let pendingRazorpayStoreOrderId: string | null = null;
    let razorpayCheckoutOpened = false;

    try {
      if (paymentMethod === 'payu') {
        const checkout = await api.createPayuCheckout({
          customer: { ...formData },
          items: cart.map(item => ({
            productId: item.product.id,
            productTitle: item.product.title,
            price: item.product.price,
            quantity: item.quantity,
            image: item.product.image,
            color: item.selectedColor
          })),
          subtotal,
          discountAmount: discount,
          promoCodeApplied: activePromo?.code,
          policyConsent,
          userToken: authenticatedUserToken
        });
        try {
          rememberPendingPayment(checkout.orderId, 'payu');
        } catch (error) {
          console.error('Could not save the PayU recovery reference:', error);
          showToast('Keep order reference ' + checkout.orderId + ' available in case you need to check this payment later.', 'error');
        }
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = checkout.checkoutUrl;
        form.style.display = 'none';
        for (const [name, value] of Object.entries(checkout.fields)) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = name;
          input.value = value;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
        return;
      }

      // 1. RAZORPAY ONLINE GATEWAY FLOW
      if (paymentMethod === 'razorpay') {
        if (!window.Razorpay) {
          const loaded = await new Promise<boolean>((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
          });
          if (!loaded || !window.Razorpay) {
            showToast('Razorpay checkout could not load. Please retry or choose another payment method.', 'error');
            setIsSubmitting(false);
            return;
          }
        }

        const storeOrder = await api.createOrder({
          customer: { ...formData },
          items: cart.map(item => ({
            productId: item.product.id,
            productTitle: item.product.title,
            price: item.product.price,
            quantity: item.quantity,
            image: item.product.image,
            color: item.selectedColor
          })),
          subtotal,
          discountAmount: discount,
          promoCodeApplied: activePromo?.code,
          paymentMethod: 'razorpay',
          status: 'pending',
          policyConsent
        }, authenticatedUserToken);
        pendingRazorpayStoreOrderId = storeOrder.id;
        try {
          rememberPendingPayment(storeOrder.id, 'razorpay');
        } catch (error) {
          console.error('Could not save the Razorpay recovery reference:', error);
          showToast('Keep order reference ' + storeOrder.id + ' available in case you need to check this payment later.', 'error');
        }
        const rzpOrder = await api.createRazorpayOrder({ orderId: storeOrder.id, userToken: authenticatedUserToken });

        const rzpKey = rzpOrder.keyId || settings.razorpayKeyId || '';
        if (!rzpKey) throw new Error('Razorpay public key is missing. Please contact store support.');

        const rzpOptions = {
          key: rzpKey,
          amount: rzpOrder.amount,
          currency: rzpOrder.currency || 'INR',
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
            setIsGatewayCheckoutOpen(false);
            setPaymentIssue({
              orderId: storeOrder.id,
              method: 'razorpay',
              state: 'checking',
              message: 'Your payment was submitted. We are confirming its status with the store.',
              createdAt: Date.now()
            });
            try {
              const razorpayOrderId = response.razorpay_order_id ?? '';
              const razorpayPaymentId = response.razorpay_payment_id ?? '';
              const razorpaySignature = response.razorpay_signature ?? '';

              const verification = await api.verifyRazorpayPayment({
                razorpay_order_id: razorpayOrderId,
                razorpay_payment_id: razorpayPaymentId,
                razorpay_signature: razorpaySignature,
                orderId: storeOrder.id,
                userToken: authenticatedUserToken
              });
              syncOrder(verification.order);
              try {
                forgetPendingPayment(storeOrder.id);
              } catch (error) {
                console.error('Could not clear the confirmed payment recovery reference:', error);
              }
              clearCart();
              clearCheckoutDraft();
              setOrderComplete(verification.order);
              setIsCheckingOut(false);
              setPaymentIssue(null);
              void triggerCelebration();
            } catch (error) {
              console.error('Razorpay confirmation request did not complete:', error);
              setPaymentIssue(previous => previous ? {
                ...previous,
                state: 'checking',
                message: 'We could not finish checking your payment yet. Your cart is saved while we check the order status.'
              } : null);
            }
          },
          modal: {
            ondismiss: () => {
              setIsGatewayCheckoutOpen(false);
              setPaymentIssue({
                orderId: storeOrder.id,
                method: 'razorpay',
                state: 'checking',
                message: 'Checkout was closed. We are checking whether a payment was completed.',
                createdAt: Date.now()
              });
              void api.cancelRazorpayOrder(storeOrder.id, authenticatedUserToken)
                .then(order => {
                  syncOrder(order);
                  if (order.status === 'cancelled' || order.paymentStatus === 'failed') {
                    try {
                      forgetPendingPayment(storeOrder.id);
                    } catch (error) {
                      console.error('Could not clear the cancelled payment recovery reference:', error);
                    }
                    setPaymentIssue(previous => previous ? {
                      ...previous,
                      state: 'failed',
                      message: 'Checkout was closed before payment was completed. Your cart and delivery details are saved.'
                    } : null);
                  }
                })
                .catch(error => {
                  console.error('Could not safely close the pending Razorpay order:', error);
                  setPaymentIssue(previous => previous ? {
                    ...previous,
                    state: 'pending',
                    message: 'We are still checking this payment. Please wait for its status before retrying.'
                  } : null);
                });
            }
          }
        };

        const rzp = new window.Razorpay(rzpOptions);
        rzp.on('payment.failed', response => {
          setIsGatewayCheckoutOpen(false);
          setPaymentIssue({
            orderId: storeOrder.id,
            method: 'razorpay',
            state: 'checking',
            message: response.error?.description || 'The payment could not be completed. We are checking the order status before you retry.',
            createdAt: Date.now()
          });
        });
        razorpayCheckoutOpened = true;
        setIsGatewayCheckoutOpen(true);
        rzp.open();
        setIsSubmitting(false);
        return;
      }

      // 2. Manual UPI / COD order flow
      const placedOrder = await createOrder(formData, authenticatedUserToken, {
        method: paymentMethod,
        status: 'pending',
        upiRefNumber: paymentMethod === 'upi' ? upiUtrNumber.trim() : undefined,
        upiCheckoutReference: paymentMethod === 'upi' ? upiCheckoutReference : undefined,
        policyConsent,
        upiPaymentAttested: paymentMethod === 'upi' ? hasConfirmedUpiDetails : undefined
      });

      if (placedOrder) {
        let completedOrder = placedOrder;
        if (paymentMethod === 'upi' && upiProofFile) {
          try {
            completedOrder = await api.uploadUpiPaymentProof(placedOrder.id, upiProofFile, authenticatedUserToken);
            syncOrder(completedOrder);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not upload the optional payment screenshot.';
            showToast(`Your order was placed, but the screenshot was not attached: ${message}`, 'error');
          }
        }
        clearCheckoutDraft();
        if (paymentMethod === 'upi') clearDirectUpiRecoveryDraft();
        setOrderComplete(completedOrder);
        setIsCheckingOut(false);
        setUpiProofFile(null);
        setUpiUtrNumber('');
        setIsUpiConfirmationOpen(false);
        void triggerCelebration();
      }
    } catch (error: unknown) {
      setIsGatewayCheckoutOpen(false);
      if (pendingRazorpayStoreOrderId && !razorpayCheckoutOpened) {
        try {
          const cancelledOrder = await api.cancelRazorpayOrder(pendingRazorpayStoreOrderId, authenticatedUserToken);
          syncOrder(cancelledOrder);
          try {
            forgetPendingPayment(pendingRazorpayStoreOrderId);
          } catch (storageError) {
            console.error('Could not clear the cancelled Razorpay recovery reference:', storageError);
          }
        } catch (cancelError) {
          console.error('Could not safely cancel the Razorpay order after checkout setup failed:', cancelError);
          setPaymentIssue({
            orderId: pendingRazorpayStoreOrderId,
            method: 'razorpay',
            state: 'pending',
            message: 'We could not safely close this payment attempt. Check its status before trying another payment.',
            createdAt: Date.now()
          });
        }
      }
      const message = error instanceof Error ? error.message : 'Failed to place order. Please check your network connection.';
      showToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isCartOpen) {
    return null;
  }

  const handleStartCheckout = () => {
    if (isLoadingUser) {
      showToast('Checking your sign-in status. Please try again in a moment.', 'info');
      return;
    }
    if (!isUserLoggedIn) {
      openUserAuthModal('signin', () => {
        setHasAcceptedStorePolicies(false);
        setHasConfirmedUpiDetails(false);
        setCheckoutStep('address');
        setIsCheckingOut(true);
      });
      return;
    }
    setHasAcceptedStorePolicies(false);
    setHasConfirmedUpiDetails(false);
    setCheckoutStep('address');
    setIsCheckingOut(true);
  };

  return (
    <div className="mobile-drawer-overlay" style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(35, 28, 22, 0.6)',
      backdropFilter: 'blur(6px)',
      zIndex: 60,
      display: 'flex',
      justifyContent: 'flex-end',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div className="mobile-drawer-panel" style={{
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
          {(cart.length > 0 || orderComplete) && (() => {
            const activeStep = orderComplete ? 3 : !isCheckingOut ? 0 : checkoutStep === 'address' ? 1 : 2;
            const steps = ['Cart', 'Address', 'Payment', 'Confirmation'];
            return (
              <ol aria-label="Checkout progress" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: '6px',
                listStyle: 'none',
                padding: 0,
                margin: '0 0 18px'
              }}>
                {steps.map((step, index) => {
                  const isCurrent = index === activeStep;
                  const isComplete = index < activeStep;
                  return (
                    <li
                      key={step}
                      aria-current={isCurrent ? 'step' : undefined}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '5px',
                        textAlign: 'center',
                        color: isCurrent || isComplete ? 'var(--accent-terracotta)' : 'var(--text-muted)',
                        fontSize: '0.68rem',
                        fontWeight: isCurrent ? 800 : 600
                      }}
                    >
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border: `1px solid ${isCurrent || isComplete ? 'var(--accent-terracotta)' : 'var(--border-medium)'}`,
                        background: isComplete ? 'var(--accent-terracotta)' : '#FFFFFF',
                        color: isComplete ? '#FFFFFF' : 'inherit',
                        fontSize: '0.7rem'
                      }}>
                        {index + 1}
                      </span>
                      {step}
                    </li>
                  );
                })}
              </ol>
            );
          })()}
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
                backgroundColor: isOrderPaymentConfirmed ? 'var(--accent-sage-light)' : 'var(--accent-amber-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isOrderPaymentConfirmed ? 'var(--accent-sage)' : 'var(--accent-amber)',
                marginBottom: '18px'
              }}>
                {isOrderPaymentConfirmed ? <CheckCircle2 size={42} /> : <Clock size={42} />}
              </div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px' }}>
                {isOrderPaymentConfirmed
                  ? `Payment received · #${getShortOrderId(orderComplete.id)}`
                  : orderComplete.paymentMethod === 'upi'
                    ? 'Payment submitted'
                    : `Order placed · #${getShortOrderId(orderComplete.id)}`}
              </h2>
              {orderComplete.paymentMethod === 'upi' ? (
                <div style={{ display: 'grid', justifyItems: 'center', gap: '8px', marginBottom: '24px' }}>
                  <span role="status" className="badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textTransform: 'none', letterSpacing: 0 }}>
                    <Clock size={14} />
                    Awaiting manual review; timing may vary.
                  </span>
                  <span className="badge-yarn" style={{ textTransform: 'none', letterSpacing: 0 }}>Order reference: #{getShortOrderId(orderComplete.id)}</span>
                </div>
              ) : (
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6, maxWidth: '380px' }}>
                  {isOrderPaymentConfirmed ? (
                    <>Thank you, <strong>{orderComplete.customer.name}</strong>! Your payment is verified and your order is being prepared.</>
                  ) : orderComplete.paymentMethod === 'cod' ? (
                    <>Thank you, <strong>{orderComplete.customer.name}</strong>! Your order is placed with Cash on Delivery. No payment has been collected; pay the courier when your parcel arrives.</>
                  ) : (
                    <>Thank you, <strong>{orderComplete.customer.name}</strong>! Your order is recorded and its payment is still pending confirmation.</>
                  )}
                </p>
              )}

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
                  onClick={async () => {
                    if (!orderComplete || isDownloadingInvoice) return;
                    setIsDownloadingInvoice(true);
                    setInvoiceDownloadError('');
                    try {
                      await downloadInvoicePDF(orderComplete, settings);
                    } catch (err: unknown) {
                      console.error('Invoice download failed:', err);
                      setInvoiceDownloadError(err instanceof Error ? err.message : 'Could not generate the invoice PDF. Please try again.');
                    } finally {
                      setIsDownloadingInvoice(false);
                    }
                  }}
                  disabled={isDownloadingInvoice}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '12px',
                    borderRadius: 'var(--radius-full)',
                    border: '1.5px solid var(--accent-terracotta)',
                    backgroundColor: isDownloadingInvoice ? '#FFF7ED' : '#FFFFFF',
                    color: 'var(--accent-terracotta)',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: isDownloadingInvoice ? 'wait' : 'pointer',
                    opacity: isDownloadingInvoice ? 0.8 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Download size={16} />
                  <span>{isDownloadingInvoice ? 'Generating invoice…' : invoiceDownloadError ? 'Retry invoice download' : 'Download Invoice PDF'}</span>
                </button>
                {invoiceDownloadError && (
                  <p role="alert" style={{ margin: 0, padding: '10px 12px', borderRadius: 10, color: '#991B1B', background: '#FEF2F2', border: '1px solid #FECACA', fontSize: '0.82rem', lineHeight: 1.5 }}>
                    {invoiceDownloadError}
                  </p>
                )}

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
          ) : paymentIssue ? (
            <div role="status" aria-live="polite" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '30px 8px',
              gap: '12px'
            }}>
              {paymentIssue.state === 'failed'
                ? <AlertCircle size={42} color="#B91C1C" />
                : <Clock size={42} color="#B45309" />}
              <h2 style={{ fontSize: '1.35rem', margin: 0, color: 'var(--text-main)' }}>
                {paymentIssue.state === 'failed'
                  ? 'Payment was not completed'
                  : 'Checking your payment status'}
              </h2>
              <p style={{ maxWidth: '390px', margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                {paymentIssue.message || 'The store is checking the payment status. We will not assume it succeeded or failed until the order status is confirmed.'}
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Order reference: #{paymentIssue.orderId}
              </p>
              <p style={{ maxWidth: '390px', margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.55 }}>
                Your cart and delivery details are saved. Please do not pay again while this order is pending.
              </p>
              {Date.now() - paymentIssue.createdAt >= 3 * 60 * 1000 && (
                <p style={{ maxWidth: '390px', margin: 0, color: '#92400E', fontSize: '0.82rem', lineHeight: 1.55 }}>
                  This is taking longer than expected. Contact support with order reference #{paymentIssue.orderId} before retrying.
                </p>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '9px', marginTop: '4px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPaymentStatusRefresh(value => value + 1)}
                  disabled={isSubmitting}
                >
                  Check status again
                </button>
                {paymentIssue.method === 'razorpay' && (paymentIssue.state === 'failed' || paymentIssue.state === 'pending') && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void handleSafelyRetryPayment()}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Checking safely…' : 'Try again or choose another method'}
                  </button>
                )}
                {paymentSupportUrl && Date.now() - paymentIssue.createdAt >= 3 * 60 * 1000 && (
                  <a href={paymentSupportUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ textDecoration: 'none' }}>
                    Contact support
                  </a>
                )}
                {!paymentSupportUrl && settings.contactPhone && Date.now() - paymentIssue.createdAt >= 3 * 60 * 1000 && (
                  <a href={`tel:${settings.contactPhone.replace(/[^\d+]/g, '')}`} className="btn-secondary" style={{ textDecoration: 'none' }}>
                    Call store support
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCartOpen(false);
                  setIsCheckingOut(false);
                }}
                style={{ border: 0, background: 'none', color: 'var(--accent-terracotta)', fontWeight: 700, cursor: 'pointer', marginTop: '6px' }}
              >
                Return to store — your order reference is saved
              </button>
            </div>
          ) : isCheckingOut ? (
            /* Multi-Gateway Production Checkout View */
            <form onSubmit={handleCheckoutSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  {checkoutStep === 'address' ? 'Delivery Details' : 'Choose Payment'}
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    if (checkoutStep === 'payment') {
                      setCheckoutStep('address');
                    } else {
                      setIsCheckingOut(false);
                    }
                  }}
                  style={{ fontSize: '0.8rem', color: 'var(--accent-terracotta)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {checkoutStep === 'payment' ? '← Back to Address' : '← Back to Bag'}
                </button>
              </div>
              {checkoutStep === 'address' ? (
                <>
              <div style={{
                padding: '10px 12px',
                borderRadius: '10px',
                background: '#F0FDF4',
                color: '#166534',
                fontSize: '0.8rem',
                lineHeight: 1.5
              }}>
                Signed in as <strong>{currentUser?.email}</strong>. Your account details have been filled in; confirm your phone number and delivery address before placing the order.
              </div>
              <p style={{ margin: '-6px 0 0', color: 'var(--text-muted)', fontSize: '0.76rem', lineHeight: 1.45 }}>
                Your delivery address is saved to your profile when you continue. You can edit it here on future orders or under My Profile.
              </p>

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
                  aria-invalid={Boolean(addressErrors.name)}
                  onChange={(e) => {
                    setFormOverrides({ ...formOverrides, name: e.target.value });
                    setAddressErrors(prev => ({ ...prev, name: '' }));
                  }}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-medium)',
                    fontSize: '16px', // Prevents iOS auto-zoom
                    boxSizing: 'border-box'
                  }}
                />
                {addressErrors.name && <p role="alert" style={{ color: '#DC2626', fontSize: '0.76rem', margin: '4px 0 0' }}>{addressErrors.name}</p>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px' }}>
                    Account Email *
                  </label>
                  <input
                    type="email"
                    required
                    readOnly
                    aria-readonly="true"
                    aria-invalid={Boolean(addressErrors.email)}
                    title="The order is placed under your signed-in account email."
                    placeholder="name@gmail.com"
                    value={formData.email}
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-medium)',
                      fontSize: '16px', // Prevents iOS auto-zoom
                      backgroundColor: '#F8FAFC',
                      boxSizing: 'border-box'
                    }}
                  />
                  {addressErrors.email && <p role="alert" style={{ color: '#DC2626', fontSize: '0.76rem', margin: '4px 0 0' }}>{addressErrors.email}</p>}
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
                    aria-invalid={Boolean(addressErrors.phone)}
                    onChange={(e) => {
                      setFormOverrides({ ...formOverrides, phone: e.target.value });
                      setAddressErrors(prev => ({ ...prev, phone: '' }));
                    }}
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-medium)',
                      fontSize: '16px', // Prevents iOS auto-zoom
                      boxSizing: 'border-box'
                    }}
                  />
                  {addressErrors.phone && <p role="alert" style={{ color: '#DC2626', fontSize: '0.76rem', margin: '4px 0 0' }}>{addressErrors.phone}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="checkout-pincode" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px' }}>
                  Delivery Pincode *
                </label>
                <input
                  id="checkout-pincode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  required
                  maxLength={6}
                  placeholder="e.g. 400001"
                  value={formData.pincode}
                  aria-invalid={Boolean(addressErrors.pincode)}
                  onChange={event => {
                    setFormOverrides(previous => ({ ...previous, pincode: event.target.value.replace(/\D/g, '').slice(0, 6) }));
                    setAddressErrors(previous => ({ ...previous, pincode: '' }));
                  }}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: `1px solid ${addressErrors.pincode ? '#DC2626' : 'var(--border-medium)'}`,
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
                {addressErrors.pincode && <p role="alert" style={{ color: '#DC2626', fontSize: '0.76rem', margin: '4px 0 0' }}>{addressErrors.pincode}</p>}
                {!addressErrors.pincode && !isFreeShipping && (
                  <div role="status" aria-live="polite" style={{ color: 'var(--text-muted)', fontSize: '0.74rem', margin: '4px 0 0' }}>
                    {requiresDistanceQuote
                      ? isUsingZoneFallback
                        ? 'Distance delivery is temporarily unavailable; the existing zone-based charge applies until the delivery API is updated.'
                        : distanceQuoteError
                        ? <span>
                          Distance delivery quote failed: {distanceQuoteError}{' '}
                          <button type="button" onClick={() => setDistanceQuoteRetry(value => value + 1)} style={{ border: 0, padding: 0, background: 'none', color: 'var(--accent-terracotta)', textDecoration: 'underline', cursor: 'pointer' }}>Retry</button>
                        </span>
                        : !isDistanceQuoteReady
                          ? 'Calculating the straight-line distance-based delivery charge…'
                          : currentDistanceQuote?.distanceKm !== undefined
                            ? `Approx. ${currentDistanceQuote.distanceKm.toFixed(1)} km straight-line from the store; ${currentDistanceQuote.zoneName} rate. Not a courier-route distance.`
                            : 'Pincode coordinates unavailable; the flat fallback charge applies.'
                      : formData.pincode
                        ? `Delivery charge applies for ${deliveryQuote.zoneName}.`
                        : 'Enter your pincode to calculate its delivery charge.'}
                  </div>
                )}
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
                  aria-invalid={Boolean(addressErrors.address)}
                  onChange={(e) => {
                    setFormOverrides({ ...formOverrides, address: e.target.value });
                    setAddressErrors(prev => ({ ...prev, address: '' }));
                  }}
                  style={{
                    width: '100%',
                    minHeight: '60px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-medium)',
                    fontSize: '16px', // Prevents iOS auto-zoom
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />
                {addressErrors.address && <p role="alert" style={{ color: '#DC2626', fontSize: '0.76rem', margin: '4px 0 0' }}>{addressErrors.address}</p>}
              </div>
                </>
              ) : (
                <>
              <section className="glass-card" style={{ padding: '12px 14px', marginBottom: '14px' }}>
                <label htmlFor="checkout-policy-consent" style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', color: 'var(--text-main)', fontSize: '0.8rem', lineHeight: 1.45, cursor: 'pointer' }}>
                  <input
                    id="checkout-policy-consent"
                    type="checkbox"
                    required
                    checked={hasAcceptedStorePolicies}
                    onChange={event => setHasAcceptedStorePolicies(event.target.checked)}
                    style={{ width: 17, height: 17, marginTop: 1, flexShrink: 0, accentColor: 'var(--accent-terracotta)' }}
                  />
                  <span>I have read and agree to the store policies.</span>
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '9px', paddingLeft: '26px' }}>
                  {([
                    ['termsAndConditions', 'Terms & Conditions'],
                    ['refundReturnPolicy', 'Refund/Return'],
                    ['privacyPolicy', 'Privacy'],
                    ['shippingPolicy', 'Shipping']
                  ] as const).map(([key, label]) => (
                    <button key={key} type="button" className="btn-outline" onClick={() => setActiveStorePolicy(key)} style={{ padding: '5px 9px', fontSize: '0.7rem' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Payment Method Selector */}
              <div style={{ marginTop: '6px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                  Choose Payment Method:
                </label>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
                  gap: '10px'
                }}>
                  {/* Option 1: Instant UPI QR & Apps */}
                  {hasValidUpiId && <label style={{
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
                      onChange={() => {
                        setPaymentMethod('upi');
                        setIsUpiConfirmationOpen(false);
                        setHasConfirmedUpiDetails(false);
                        beginDirectUpiRecovery();
                      }}
                    />
                    <QrCode size={20} color="var(--accent-terracotta)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                        UPI Direct
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Pay manually using the studio’s UPI ID or scan its uploaded QR code.
                      </div>
                    </div>
                  </label>}

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
                      <CreditCard size={20} color="#2563EB" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                          Razorpay Secure Gateway
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Cards, UPI, NetBanking and wallets via Razorpay
                        </div>
                      </div>
                    </label>
                  )}

                  {/* Option 3: PayU Hosted Checkout */}
                  {settings.paymentPayuEnabled && settings.payuConfigured && (
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: paymentMethod === 'payu' ? '2px solid var(--accent-terracotta)' : '1px solid var(--border-medium)',
                      backgroundColor: paymentMethod === 'payu' ? 'var(--accent-terracotta-light)' : '#FFFFFF',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="payu"
                        checked={paymentMethod === 'payu'}
                        onChange={() => setPaymentMethod('payu')}
                      />
                      <CreditCard size={20} color="#7E22CE" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                          PayU Secure Checkout
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Pay securely using the payment methods available through PayU.
                        </div>
                      </div>
                    </label>
                  )}

                  {/* Option 3: Cash on Delivery (COD) */}
                  {isCodAvailableForCart && (
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
                      <Truck size={20} color="#16A34A" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                          Cash on Delivery (COD)
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Pay the courier when your parcel is delivered
                        </div>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {settings.paymentCodEnabled !== false && codUnavailableProducts.length > 0 && (
                <div role="status" style={{
                  marginTop: '10px',
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1px solid #FDE68A',
                  background: '#FFFBEB',
                  color: '#78350F',
                  fontSize: '0.82rem',
                  lineHeight: 1.5
                }}>
                  <div style={{ fontWeight: 800, marginBottom: '4px' }}>
                    Cash on Delivery is unavailable for this entire cart
                  </div>
                  <div style={{ color: '#92400E', marginBottom: '10px' }}>
                    COD is disabled for the product{codUnavailableProducts.length === 1 ? '' : 's'} below. Because your order contains {codUnavailableProducts.length === 1 ? 'this item' : 'these items'}, COD cannot be selected for any item in this cart.
                    {nonCodPaymentLabels.length > 0
                      ? ` Choose ${nonCodPaymentLabels.join(', ')} to continue.`
                      : ' No other payment methods are available right now; please contact the store for help.'}
                  </div>
                  <div style={{ display: 'grid', gap: '7px' }}>
                    {codUnavailableProducts.map(product => (
                      <div
                        key={product.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          flexWrap: 'wrap',
                          padding: '9px 11px',
                          borderRadius: '9px',
                          background: '#FFFFFF',
                          border: '1px solid #FDE68A'
                        }}
                      >
                        <span style={{ fontWeight: 700, color: '#451A03' }}>{product.name}</span>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '3px 8px',
                          borderRadius: '999px',
                          background: '#FEF3C7',
                          color: '#92400E',
                          fontSize: '0.7rem',
                          fontWeight: 800
                        }}>
                          {product.category || 'Uncategorized'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {availablePaymentMethods.length === 0 && (
                <div role="alert" style={{
                  marginTop: '10px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid #FECACA',
                  background: '#FEF2F2',
                  color: '#991B1B',
                  fontSize: '0.82rem',
                  lineHeight: 1.45
                }}>
                  No payment methods are currently available. Please contact the store to complete your order.
                </div>
              )}

              {paymentMethod === 'upi' && (
                <div className="glass-card" style={{
                  padding: '16px'
                }}>
                  <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1E293B' }}>
                      Pay {settings.currency}{total.toFixed(2)} with UPI
                    </div>
                    <span role="status" className="badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '6px', textTransform: 'none', letterSpacing: 0 }}>
                      <Clock size={14} />
                      The store checks your payment after you submit its reference.
                    </span>
                  </div>

                  <div className="upi-mobile-guidance badge-amber" style={{
                    display: 'none',
                    gap: '8px',
                    alignItems: 'center',
                    marginBottom: '14px',
                    fontSize: '0.82rem',
                    textTransform: 'none',
                    letterSpacing: 0
                  }}>
                    <Smartphone size={16} style={{ flexShrink: 0 }} />
                    <span>{isIosDevice
                      ? 'On iPhone, use the QR or copied UPI ID if the app link does not open.'
                      : isAndroidDevice
                        ? 'Use the app button, QR, or copied UPI ID to pay.'
                        : 'Use the QR or copied UPI ID to pay.'}</span>
                  </div>

                  <div className="upi-payment-layout" style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                    gap: '14px',
                    alignItems: 'stretch'
                  }}>
                    <div className="upi-payment-qr" style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 0,
                      padding: '12px',
                      border: '1px solid #E2E8F0',
                      borderRadius: '14px',
                      background: '#FFFFFF'
                    }}>
                      <img
                        src={getAssetUrl(settings.upiQrImage)}
                        alt="Studio-provided UPI payment QR code"
                        style={{
                          display: 'block',
                          width: 'min(300px, 100%)',
                          aspectRatio: '1',
                          objectFit: 'contain',
                          imageRendering: 'pixelated'
                        }}
                      />
                    </div>

                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: '10px',
                      minWidth: 0,
                      padding: '14px',
                      border: '1px solid #E2E8F0',
                      borderRadius: '14px',
                      background: '#FFFFFF'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 800, color: '#1E293B' }}>
                        <Landmark size={17} color="var(--accent-terracotta)" />
                        Pay via UPI ID
                      </div>
                      <div style={{ fontSize: '0.76rem', lineHeight: 1.45, color: '#64748B' }}>
                        Pay {settings.currency}{total.toFixed(2)} with the QR or copied ID.
                      </div>
                      <label htmlFor="checkout-upi-id" style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569' }}>
                        UPI ID
                      </label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                        <input
                          id="checkout-upi-id"
                          type="text"
                          readOnly
                          value={upiId}
                          onFocus={event => event.currentTarget.select()}
                          aria-label="UPI ID to pay"
                          style={{
                            minWidth: 0,
                            flex: 1,
                            padding: '10px 11px',
                            border: '1px solid #CBD5E1',
                            borderRadius: '9px',
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            color: '#1E293B',
                            background: '#F8FAFC'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => void handleCopyUpiId()}
                          aria-label={hasCopiedUpiId ? 'UPI ID copied' : 'Copy UPI ID'}
                          style={{
                            flexShrink: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '0 12px',
                            border: '1px solid #CBD5E1',
                            borderRadius: '9px',
                            background: '#FFFFFF',
                            color: '#334155',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {hasCopiedUpiId ? <Check size={16} /> : <Copy size={16} />}
                          <span>{hasCopiedUpiId ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      {isMobileDevice && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const reference = beginDirectUpiRecovery();
                              window.location.assign(createUpiPaymentLink(reference));
                            }}
                            className={isIosDevice ? 'btn-outline' : 'btn-primary'}
                            disabled={!hasAcceptedStorePolicies}
                            title={!hasAcceptedStorePolicies ? 'Agree to the store policies first' : undefined}
                            style={{ width: '100%', minHeight: '44px', padding: '10px 12px', fontSize: '0.82rem' }}
                          >
                            <Smartphone size={17} />
                            Pay with any UPI App (GPay / PhonePe / Paytm)
                          </button>
                          <span role="note" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', lineHeight: 1.4, color: 'var(--text-muted)' }}>
                            <AlertCircle size={14} />
                            After paying, return here to confirm with your payment reference.
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {!isUpiConfirmationOpen ? (
                    <button
                      type="button"
                      onClick={() => setIsUpiConfirmationOpen(true)}
                      className={isAndroidDevice ? 'btn-secondary' : 'btn-primary'}
                      style={{ width: '100%', marginTop: '12px', padding: '12px', fontSize: '0.88rem' }}
                    >
                      <CheckCircle2 size={17} />
                      <span>I've Completed the Payment</span>
                    </button>
                  ) : (
                    <>
                      <div style={{ marginTop: '12px' }}>
                        <label htmlFor="checkout-upi-utr" style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                          Payment reference (UTR) *
                        </label>
                        <input
                          id="checkout-upi-utr"
                          type="tel"
                          inputMode="numeric"
                          placeholder="12-digit UTR"
                          autoComplete="off"
                          maxLength={12}
                          aria-invalid={Boolean(upiUtrError)}
                          aria-describedby={upiUtrError ? 'checkout-upi-utr-error' : undefined}
                          value={upiUtrNumber}
                          onChange={(e) => {
                            setUpiUtrNumber(e.target.value.replace(/\D/g, '').slice(0, 12));
                            setUpiUtrError('');
                          }}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                            fontSize: '0.86rem'
                          }}
                        />
                        {upiUtrError && <p id="checkout-upi-utr-error" role="alert" style={{ margin: '5px 0 0', color: '#B91C1C', fontSize: '0.76rem' }}>{upiUtrError}</p>}
                      </div>

                      <label htmlFor="checkout-upi-attestation" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '12px', fontSize: '0.78rem', lineHeight: 1.45, color: 'var(--text-main)', cursor: 'pointer' }}>
                        <input
                          id="checkout-upi-attestation"
                          type="checkbox"
                          required
                          checked={hasConfirmedUpiDetails}
                          onChange={event => setHasConfirmedUpiDetails(event.target.checked)}
                          style={{ width: 16, height: 16, marginTop: 1, flexShrink: 0, accentColor: 'var(--accent-terracotta)' }}
                        />
                        <span>I confirm the payment details I entered are accurate.</span>
                      </label>

                      <div style={{ marginTop: '12px' }}>
                        <label htmlFor="checkout-upi-proof" style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                          Payment screenshot (optional)
                        </label>
                        <input
                          ref={upiProofFileInputRef}
                          id="checkout-upi-proof"
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          onChange={handleUpiProofSelection}
                          style={{ display: 'none' }}
                        />
                        <button
                          type="button"
                          className="btn-outline"
                          onClick={() => upiProofFileInputRef.current?.click()}
                          style={{ padding: '7px 12px', fontSize: '0.78rem' }}
                        >
                          {upiProofFile ? 'Replace screenshot' : 'Add screenshot (optional)'}
                        </button>
                        {upiProofFile && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '6px', fontSize: '0.76rem', color: '#475569' }}>
                            <span style={{ overflowWrap: 'anywhere' }}>{upiProofFile.name}</span>
                            <button type="button" className="btn-secondary" onClick={() => setUpiProofFile(null)} style={{ padding: '5px 9px', fontSize: '0.72rem' }}>
                              Remove
                            </button>
                          </div>
                        )}
                        <p style={{ fontSize: '0.72rem', color: '#64748B', margin: '5px 0 0' }}>
                          Up to 5 MB. Only the store can view it.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Order total */}
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
                {paymentMethod === 'cod' && (
                  <div style={{ marginTop: '10px', padding: '12px', borderRadius: '10px', background: '#F0FDF4', color: '#166534', fontSize: '0.8rem', lineHeight: 1.45 }}>
                    Pay {settings.currency}{total.toFixed(2)} to the courier when your order arrives. You will not be charged online now.
                  </div>
                )}
                {paymentMethod === 'razorpay' && (
                  <div style={{ marginTop: '10px', padding: '12px', borderRadius: '10px', background: '#EFF6FF', color: '#1E40AF', fontSize: '0.8rem', lineHeight: 1.45 }}>
                    Your payment will be processed securely by Razorpay. The order is confirmed only after Razorpay verifies the payment.
                  </div>
                )}
                {paymentMethod === 'payu' && (
                  <div style={{ marginTop: '10px', padding: '12px', borderRadius: '10px', background: '#F5F3FF', color: '#5B21B6', fontSize: '0.8rem', lineHeight: 1.45 }}>
                    You’ll continue to PayU to complete payment. The order is marked paid only after the server verifies the transaction.
                  </div>
                )}
                </div>
                </>
              )}
              {checkoutStep === 'address' ? (
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ width: '100%', padding: '14px', fontSize: '0.96rem' }}
                >
                  <span>Continue to Payment</span>
                  <ArrowRight size={16} />
                </button>
              ) : paymentMethod !== 'upi' || isUpiConfirmationOpen ? (
                <button
                  type="submit"
                  disabled={isSubmitting || availablePaymentMethods.length === 0 || !hasAcceptedStorePolicies || (paymentMethod === 'upi' && isUpiConfirmationOpen && !hasConfirmedUpiDetails)}
                  aria-busy={isSubmitting}
                  className="btn-primary"
                  style={{ width: '100%', padding: '14px', fontSize: '0.96rem' }}
                >
                  <ShieldCheck size={18} />
                  <span>
                    {isSubmitting
                      ? paymentMethod === 'razorpay'
                        ? 'Opening secure Razorpay checkout…'
                        : paymentMethod === 'payu'
                          ? 'Connecting to PayU…'
                          : paymentMethod === 'upi'
                            ? 'Submitting…'
                            : 'Placing order…'
                      : paymentMethod === 'razorpay'
                      ? 'Pay with Razorpay'
                      : paymentMethod === 'payu'
                      ? 'Continue to PayU'
                      : paymentMethod === 'upi'
                      ? 'Submit Payment for Verification'
                      : 'Confirm Cash on Delivery Order'}
                  </span>
                </button>
              ) : null}
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
                  <StorefrontImage
                    src={getAssetUrl(item.product.image)}
                    alt={item.product.title}
                    width={74}
                    height={74}
                    transformWidth={148}
                    transformHeight={148}
                    loading="eager"
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
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
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
                            disabled={!!(item.product.maxOrderQuantity && item.quantity >= item.product.maxOrderQuantity)}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              fontWeight: 700,
                              border: 'none',
                              background: 'transparent',
                              cursor: (item.product.maxOrderQuantity && item.quantity >= item.product.maxOrderQuantity) ? 'not-allowed' : 'pointer',
                              opacity: (item.product.maxOrderQuantity && item.quantity >= item.product.maxOrderQuantity) ? 0.35 : 1
                            }}
                          >
                            +
                          </button>
                        </div>
                        {item.product.maxOrderQuantity && (
                          <span style={{ fontSize: '0.66rem', color: 'var(--accent-terracotta)', fontWeight: 600, textAlign: 'center' }}>
                            max {item.product.maxOrderQuantity}
                          </span>
                        )}
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
                <span>
                  {isFreeShipping
                    ? 'Delivery'
                    : requiresDistanceQuote && !isDistanceQuoteReady
                      ? `Distance delivery · calculating${formData.pincode ? ` · ${formData.pincode}` : ''}`
                      : isUsingZoneFallback
                        ? `${deliveryQuote.zoneName} Delivery · distance API unavailable`
                      : deliveryQuote.pricingMode === 'distance'
                        ? deliveryQuote.distanceKm !== undefined
                          ? `Distance delivery · approx. ${deliveryQuote.distanceKm.toFixed(1)} km straight-line`
                          : `Distance fallback · ${formData.pincode}`
                        : `${deliveryQuote.zoneName} Delivery${formData.pincode ? ` · ${formData.pincode}` : ''}`}
                </span>
                <span>
                  {isFreeShipping
                    ? 'Free Shipping'
                    : requiresDistanceQuote && !isDistanceQuoteReady
                      ? 'Calculating…'
                      : `${settings.currency}${shippingCost.toFixed(2)}`}
                </span>
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
              onClick={handleStartCheckout}
              disabled={isLoadingUser}
              className="btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '0.96rem', opacity: isLoadingUser ? 0.7 : 1 }}
            >
              <span>{isLoadingUser ? 'Checking Account…' : isUserLoggedIn ? 'Proceed to Checkout' : 'Sign in to Checkout'}</span>
              <ArrowRight size={16} />
            </button>

            {/* WhatsApp Order Button */}
            {whatsappOrderUrl && (
              <a
                href={whatsappOrderUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={event => {
                  if (isLoadingUser) {
                    event.preventDefault();
                    showToast('Checking your sign-in status. Please try again in a moment.', 'info');
                  } else if (!isUserLoggedIn) {
                    event.preventDefault();
                    openUserAuthModal('signin');
                  }
                }}
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
                <span>{isUserLoggedIn ? 'Order via WhatsApp' : 'Sign in to order via WhatsApp'}</span>
              </a>
            )}
          </div>
        )}
      </div>
      <StorePolicyDialog
        policyKey={activeStorePolicy}
        policies={settings.storePolicies}
        policyVersion={settings.storePolicyVersion}
        settings={settings}
        onClose={() => setActiveStorePolicy(null)}
      />
    </div>
  );
};

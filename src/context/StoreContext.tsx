import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Product, Offer, Order, OrderPolicyConsentRequest, OrderCreatePayload, CartItem, ViewMode, DashboardTab, StoreSettings, Review, AdminRole } from '../types';
import { api } from '../services/api';

const GUEST_CART_KEY = 'dopamean_cart';

const DEFAULT_STORE_POLICIES = {
  termsAndConditions: `All products are 100% handmade. Slight variations in colour, size, pattern, or texture between product photos and the item received are normal and are not defects.\n\nOrders are processed within 1–2 business days after payment confirmation. Payment options are the ones shown for your order at checkout. Direct UPI payments are checked manually and confirmation may take a few hours.\n\nPrices are shown in INR and include applicable taxes unless stated otherwise.\n\nWe may cancel an order if an item is unavailable, a pricing error is found, or fraud is reasonably suspected. If we cancel, we will issue a full refund.\n\nWe take reasonable care to keep product information accurate. Delivery estimates may be affected by courier or logistics delays outside our control. Nothing in these terms limits rights available to customers under applicable Indian law.`,
  refundReturnPolicy: `Return or exchange requests must be made within 7 days of delivery. Items must be unused and returned in their original condition and packaging.\n\nMinor handmade variations are not defects. This does not limit your rights if an item is genuinely defective, damaged as shipped, incorrect, or materially different from its description.\n\nTo request a return, contact us within the return window with your order ID and photos of the issue. We will review the request and confirm whether it is approved.\n\nAfter approval, return the item to the address we provide. Return shipping is arranged and paid by the customer unless the return is due to our error or a genuine defect/damage as shipped. Use a trackable service; we cannot take responsibility for a return parcel lost in transit.\n\nIf an item is returned in a condition materially different from when it was shipped, beyond the issue reported and ordinary handling needed to identify it, the return may be rejected. The original reported defect or damage will be considered during inspection.\n\nAfter we receive and inspect an approved return, refunds are processed within 5–7 business days to the original payment method. Direct UPI refunds are sent manually to the same UPI ID.\n\nOriginal shipping charges and customer-paid return shipping are non-refundable unless the return is due to our error or a genuine defect/damage as shipped. In those cases, we reimburse reasonable return shipping costs.`,
  privacyPolicy: `We collect the name, email address, phone number, delivery address, and order history that you provide when using the store.\n\nWe use this information to manage your account, process and deliver orders, provide customer support, and meet legal obligations. We do not sell your personal data. We share only the information needed with payment providers (such as Razorpay or PayU) to process payments and delivery partners to deliver orders.\n\nStore data is hosted using Supabase services with access controls. We do not store payment card details; card payments are handled by the relevant payment provider.\n\nYou may request access to or deletion of your personal data, subject to information we must retain by law. For privacy requests or complaints, contact {{contactEmail}}. This notice is intended to describe our practices under applicable Indian data-protection law; please contact us if you have questions.`,
  shippingPolicy: `We currently ship within India only.\n\nEstimated delivery is 4–7 business days, depending on the destination and courier service. This is an estimate, not a guaranteed delivery date.\n\nShipping charges for your order are shown at checkout before you place it. Free shipping applies to orders above {{freeShippingThreshold}}.`
};

const getCartStorageKey = (ownerId: string | null) => ownerId
  ? `${GUEST_CART_KEY}:user:${encodeURIComponent(ownerId)}`
  : GUEST_CART_KEY;

const readStoredCart = (ownerId: string | null): CartItem[] | null => {
  try {
    const saved = localStorage.getItem(getCartStorageKey(ownerId));
    return saved ? JSON.parse(saved) as CartItem[] : null;
  } catch {
    return null;
  }
};

const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'Cozy Loops by Deepa',
  storeTagline: 'Cozy, Handmade Happiness • Premium Crochet Hair Accessories',
  heroBadge: '🌸 100% Handcrafted with Love',
  heroTitle: 'Cozy Loops by Deepa',
  heroSubtitle: '100% handmade with love. Big flower rose ponytail holders, sunny clips, and handcrafted floral accessories.',
  introSplashEnabled: true,
  introSplashDurationMs: 2500,
  categoryTopStockPreviewCount: 4,
  categoryOtherPreviewCount: 2,
  categoryProductSortOrder: 'bestseller-newest',
  showLaunchRail: true,
  launchRailProductsLimit: 6,
  launchRailProductSortOrder: 'newest',
  announcementText: '100% Handmade with Love 🌸 Free Shipping on orders above ₹299',
  currency: '₹',
  freeShippingThreshold: 299,
  shippingFee: 40,
  storePolicies: DEFAULT_STORE_POLICIES,
  storePolicyVersion: 1,
  lowStockThreshold: 5,
  productCardBadgePriority: ['bestseller', 'discount', 'lowStock', 'craftTime'],
  showTestimonialsSection: false,
  contactEmail: 'dsoni7018@gmail.com',
  contactPhone: '+91 98765 43210',
  instagramHandle: '@cozyloopsbydeepa',
  studioLocation: 'Handcrafted Studio, India',
  heroImage: '',
  adminPasscode: '',
  artisanCommissionRate: 15,
  commissionType: 'percentage',
  defaultCourierPartner: 'India Post Speed Post',
  estimatedCraftingDays: 3,
  deliveryStagePlacedLabel: 'Order placed',
  deliveryStageConfirmedLabel: 'Confirmed',
  deliveryStageInPreparationLabel: 'In preparation',
  deliveryStageShippedLabel: 'Shipped',
  deliveryStageOutForDeliveryLabel: 'Out for delivery',
  deliveryStageDeliveredLabel: 'Delivered',
  autoMarkCodPaidOnDelivered: true,
  whatsappEnabled: true,
  whatsappBusinessPhone: '',
  whatsappCountryCode: '91',
  whatsappOrderButtonEnabled: true,
  whatsappOrderReceivedEnabled: true,
  whatsappOrderConfirmedEnabled: true,
  whatsappOrderShippedEnabled: true,
  whatsappOutForDeliveryEnabled: true,
  whatsappOrderDeliveredEnabled: true,
  whatsappOrderCancelledEnabled: true,
  whatsappCodReminderEnabled: true,
  whatsappSupportEnabled: true,
  paymentUpiEnabled: true,
  codRules: [],
  upiId: '',
  upiPayeeName: 'Deepa Soni (Cozy Loops)',
  paymentCodEnabled: true,
  paymentRazorpayEnabled: true,
  paymentPayuEnabled: false,
  payuTestMode: true,
  razorpayKeyId: ''
};

interface StoreContextType {
  settings: StoreSettings;
  products: Product[];
  offers: Offer[];
  orders: Order[];
  cart: CartItem[];
  activePromo: Offer | null;
  viewMode: ViewMode;
  dashboardTab: DashboardTab;
  searchQuery: string;
  selectedCategory: string;
  isCartOpen: boolean;
  selectedProductForModal: Product | null;
  selectedOfferForModal: Offer | null;
  toastMessage: { text: string; type: 'success' | 'info' | 'error' } | null;
  isLoading: boolean;
  isAdmin: boolean;
  adminRole: AdminRole;
  isAdminLoginModalOpen: boolean;
  isTrackingModalOpen: boolean;
  activeInvoiceOrder: Order | null;
  deliveryOrders: Order[];
  setDeliveryOrders: React.Dispatch<React.SetStateAction<Order[]>>;

  setIsAdminLoginModalOpen: (open: boolean) => void;
  setIsTrackingModalOpen: (open: boolean) => void;
  setActiveInvoiceOrder: (order: Order | null) => void;
  adminLogin: (passcode: string, superAdmin?: { superAdminId: string; superAdminPassword: string }) => Promise<boolean>;
  deliveryAgentLogin: (passcode: string) => Promise<boolean>;
  adminLogout: () => void;

  setViewMode: (mode: ViewMode) => void;
  setDashboardTab: (tab: DashboardTab) => void;
  setSearchQuery: (q: string) => void;
  setSelectedCategory: (cat: string) => void;
  setIsCartOpen: (open: boolean) => void;
  setCartOwner: (ownerId: string | null) => void;
  setSelectedProductForModal: (p: Product | null) => void;
  setSelectedOfferForModal: (offer: Offer | null) => void;
  showToast: (text: string, type?: 'success' | 'info' | 'error') => void;

  updateSettings: (newSettings: Partial<StoreSettings>) => Promise<void>;
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'rating' | 'reviewsCount'>) => Promise<Product>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  addOffer: (offer: Omit<Offer, 'id'>) => Promise<Offer>;
  updateOffer: (id: string, updates: Partial<Offer>) => Promise<void>;
  deleteOffer: (id: string) => Promise<void>;
  toggleOfferStatus: (id: string) => Promise<void>;

  addToCart: (product: Product, quantity?: number) => void;
  updateCartQuantity: (productId: string, delta: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  applyPromoCode: (code: string) => { success: boolean; message: string };
  removePromoCode: () => void;

  createOrder: (
    customer: { name: string; email: string; phone?: string; address: string },
    userToken: string,
    paymentInfo?: {
      method?: 'cod' | 'upi' | 'razorpay' | 'payu' | 'whatsapp';
      status?: 'pending' | 'paid';
      upiRefNumber?: string;
      upiCheckoutReference?: string;
      policyConsent?: OrderPolicyConsentRequest;
      upiPaymentAttested?: boolean;
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
    }
  ) => Promise<Order | null>;
  syncOrder: (order: Order) => void;
  updateOrderStatus: (
    orderId: string, 
    status: Order['status'], 
    extras?: { 
      trackingNumber?: string; 
      paymentStatus?: Order['paymentStatus'];
      courierPartner?: string;
      cancelReason?: string;
      deliveryNotes?: string;
    }
  ) => Promise<void>;
  submitReview: (productId: string, rating: number, comment: string, customerName?: string, customerEmail?: string) => Promise<Review>;
  refreshData: () => Promise<void>;
  resetDatabase: () => Promise<void>;
  loadSampleTemplate: () => Promise<void>;
}

/* eslint-disable react-refresh/only-export-components */
const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cartOwner, setCartOwnerState] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => readStoredCart(null) || []);

  const [activePromo, setActivePromo] = useState<Offer | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<AdminRole>(null);
  const [deliveryOrders, setDeliveryOrders] = useState<Order[]>([]);
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [activeInvoiceOrder, setActiveInvoiceOrder] = useState<Order | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('store');
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [selectedOfferForModal, setSelectedOfferForModalState] = useState<Offer | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setProductModal = (product: Product | null) => {
    setSelectedProductForModal(product);
    if (product) setSelectedOfferForModalState(null);
  };

  const setOfferModal = (offer: Offer | null) => {
    setSelectedOfferForModalState(offer);
    if (offer) setSelectedProductForModal(null);
  };

  const showToast = useCallback((text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(prev => (prev?.text === text ? null : prev));
    }, 4200);
  }, []);

  const setCartOwner = useCallback((ownerId: string | null) => {
    const nextOwner = ownerId?.trim() || null;
    if (nextOwner === cartOwner) return;

    let nextCart = readStoredCart(nextOwner);
    let transferGuestCart = false;
    try {
      if (nextOwner && nextCart === null && cartOwner === null) {
        const guestCart = readStoredCart(null);
        if (guestCart?.length) {
          localStorage.setItem(getCartStorageKey(nextOwner), JSON.stringify(guestCart));
          localStorage.removeItem(GUEST_CART_KEY);
          nextCart = guestCart;
          transferGuestCart = true;
        }
      }
    } catch {
      console.warn('Failed to persist cart ownership: localStorage unavailable');
    }

    if (!transferGuestCart) setActivePromo(null);
    setCartOwnerState(nextOwner);
    setCart(nextCart || []);
  }, [cartOwner]);

  // Fetch initial data from the configured backend database
  const loadData = useCallback(async () => {
    try {
      const [fetchedSettings, fetchedProducts] = await Promise.all([
        api.getSettings().catch(() => DEFAULT_SETTINGS),
        api.getProducts().catch(() => [])
      ]);

      setSettings(fetchedSettings);
      setProducts(fetchedProducts);
      setIsLoading(false);

      const [fetchedOffers, fetchedOrders] = await Promise.all([
        api.getOffers().catch(() => []),
        api.getOrders().catch(() => [])
      ]);
      setOffers(fetchedOffers);
      setOrders(fetchedOrders);
    } catch {
      console.warn('Backend loading warning: unable to hydrate storefront data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    await loadData();
  }, [loadData]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
    void api.verifyAdmin().then(result => {
      if (typeof result === 'object' && result !== null && 'role' in result) {
        const r = (result as { valid: boolean; role: AdminRole }).role;
        setAdminRole(r);
        if (r === 'delivery_agent') {
          setViewMode('delivery');
          void api.getDeliveryOrders().then(setDeliveryOrders).catch(() => setDeliveryOrders([]));
        } else if (r === 'superadmin' || r === 'admin') {
          setIsAdmin(true);
          void api.getOrders().then(setOrders).catch(() => setOrders([]));
          setViewMode('dashboard');
        }
      } else if (result === true) {
        setIsAdmin(true);
        void api.getOrders().then(setOrders).catch(() => setOrders([]));
      }
    });
  }, [loadData]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const refreshManagerData = async () => {
      const [latestOrders, latestProducts] = await Promise.all([
        api.getOrders().catch(() => null),
        api.getProducts().catch(() => null)
      ]);
      if (!active) return;
      if (latestOrders) setOrders(latestOrders);
      if (latestProducts) setProducts(latestProducts);
    };
    const intervalId = window.setInterval(() => { void refreshManagerData(); }, 10000);
    return () => { active = false; window.clearInterval(intervalId); };
  }, [isAdmin]);

  // Delivery agent auto-refresh
  useEffect(() => {
    if (adminRole !== 'delivery_agent') return;
    let active = true;
    const refresh = async () => {
      const orders = await api.getDeliveryOrders().catch(() => null);
      if (active && orders) setDeliveryOrders(orders);
    };
    const intervalId = window.setInterval(() => { void refresh(); }, 15000);
    return () => { active = false; window.clearInterval(intervalId); };
  }, [adminRole]);

  // Dynamically update theme color across the whole application
  useEffect(() => {
    if (settings.themeColor) {
      document.documentElement.style.setProperty('--accent-terracotta', settings.themeColor);
      document.documentElement.style.setProperty('--accent-terracotta-hover', settings.themeColor);
      document.documentElement.style.setProperty('--border-dashed', `${settings.themeColor}55`);
      document.documentElement.style.setProperty('--shadow-glow', `0 0 25px ${settings.themeColor}38`);
    }
  }, [settings.themeColor]);

  // Save the active guest or customer cart separately.
  useEffect(() => {
    try {
      localStorage.setItem(getCartStorageKey(cartOwner), JSON.stringify(cart));
    } catch {
      console.warn('Failed to persist cart: localStorage unavailable');
    }
  }, [cart, cartOwner]);

  // Super Admin / Studio Admin login
  const adminLogin = async (passcode: string, superAdmin?: { superAdminId: string; superAdminPassword: string }): Promise<boolean> => {
    try {
      let result;
      if (superAdmin) {
        result = await api.superAdminLogin(superAdmin.superAdminId, superAdmin.superAdminPassword);
      } else {
        result = await api.adminLogin(passcode);
      }
      if (result?.success) {
        const authenticatedOrders = await api.getOrders();
        setIsAdmin(true);
        setAdminRole(result.role as AdminRole);
        setOrders(authenticatedOrders);
        setIsAdminLoginModalOpen(false);
        setViewMode('dashboard');
        showToast(result.role === 'superadmin' ? '🔐 Super Admin mode activated!' : 'Welcome to Studio Dashboard!');
        return true;
      }
      return false;
    } catch {
      api.adminLogout();
      setIsAdmin(false);
      setAdminRole(null);
      return false;
    }
  };

  // Delivery Agent login
  const deliveryAgentLogin = async (passcode: string): Promise<boolean> => {
    try {
      const result = await api.deliveryAgentLogin(passcode);
      if (result?.success) {
        const orders = await api.getDeliveryOrders();
        setAdminRole('delivery_agent');
        setDeliveryOrders(orders);
        setIsAdminLoginModalOpen(false);
        setViewMode('delivery');
        showToast('🚚 Delivery Agent mode — ready for dispatch!');
        return true;
      }
      return false;
    } catch {
      api.deliveryLogout();
      setAdminRole(null);
      return false;
    }
  };

  const adminLogout = () => {
    setIsAdmin(false);
    setAdminRole(null);
    setDeliveryOrders([]);
    api.adminLogout();
    setOrders([]);
    setViewMode('store');
    showToast('Signed out successfully', 'info');
  };

  // SETTINGS
  const updateSettings = async (newSettings: Partial<StoreSettings>) => {
    try {
      const updated = await api.updateSettings(newSettings);
      setSettings(updated);
      showToast('Store settings updated successfully! ✨');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update settings';
      showToast(message, 'error');
      throw error;
    }
  };

  // PRODUCTS
  const addProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'rating' | 'reviewsCount'>): Promise<Product> => {
    const created = await api.addProduct(productData);
    setProducts(prev => [created, ...prev]);
    showToast(`Added "${created.title}" to catalog!`);
    return created;
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    try {
      const updated = await api.updateProduct(id, updates);
      setProducts(prev => prev.map(p => (p.id === id ? updated : p)));
      if (selectedProductForModal?.id === id) {
        setSelectedProductForModal(updated);
      }
      showToast(`Updated "${updated.title}"`);
    } catch {
      showToast('Failed to update product', 'error');
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await api.deleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
      if (selectedProductForModal?.id === id) {
        setSelectedProductForModal(null);
      }
      showToast('Product removed from catalog', 'info');
    } catch {
      showToast('Failed to delete product', 'error');
    }
  };

  // OFFERS
  const addOffer = async (offerData: Omit<Offer, 'id'>): Promise<Offer> => {
    const created = await api.addOffer(offerData);
    setOffers(prev => [created, ...prev]);
    showToast(`Promo campaign "${created.code}" created!`);
    return created;
  };

  const updateOffer = async (id: string, updates: Partial<Offer>) => {
    try {
      const updated = await api.updateOffer(id, updates);
      setOffers(prev => prev.map(o => (o.id === id ? updated : o)));
      showToast(`Promo "${updated.code}" updated`);
    } catch {
      showToast('Failed to update offer', 'error');
    }
  };

  const deleteOffer = async (id: string) => {
    try {
      await api.deleteOffer(id);
      setOffers(prev => prev.filter(o => o.id !== id));
      if (activePromo?.id === id) {
        setActivePromo(null);
      }
      showToast('Offer campaign removed', 'info');
    } catch {
      showToast('Failed to delete offer', 'error');
    }
  };

  const toggleOfferStatus = async (id: string) => {
    try {
      const updated = await api.toggleOfferStatus(id);
      setOffers(prev => prev.map(o => (o.id === id ? updated : o)));
      showToast(`Offer ${updated.isActive ? 'activated' : 'paused'}`);
    } catch {
      showToast('Failed to toggle offer', 'error');
    }
  };

  // CART
  const addToCart = (product: Product, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      const maxQty = product.maxOrderQuantity;
      if (existing) {
        const newQty = existing.quantity + quantity;
        const cappedQty = maxQty ? Math.min(newQty, maxQty) : newQty;
        if (maxQty && existing.quantity >= maxQty) {
          showToast(`⚠️ Max ${maxQty} per order for "${product.title}"`, 'error');
          return prev;
        }
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: cappedQty }
            : item
        );
      }
      const initialQty = maxQty ? Math.min(quantity, maxQty) : quantity;
      return [...prev, { product, quantity: initialQty }];
    });
    setIsCartOpen(true);
    showToast(`Added ${quantity}x "${product.title}" to cart! 🧶`);
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev
        .map(item => {
          if (item.product.id === productId) {
            const maxQty = item.product.maxOrderQuantity;
            const newQty = item.quantity + delta;
            if (maxQty && newQty > maxQty) {
              showToast(`⚠️ Max ${maxQty} per order for "${item.product.title}"`, 'error');
              return { ...item, quantity: maxQty };
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
    showToast('Item removed from cart', 'info');
  };

  const clearCart = () => {
    setCart([]);
  };

  const applyPromoCode = (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed === 'OFFSPRING') {
      return { success: false, message: 'Invalid or expired promotional code' };
    }
    const offer = offers.find(o => o.code.toUpperCase() === trimmed && o.isActive);

    if (!offer) {
      return { success: false, message: 'Invalid or expired promotional code' };
    }

    const subtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
    if (offer.minOrderValue && subtotal < offer.minOrderValue) {
      return {
        success: false,
        message: `Requires minimum order of ${settings.currency}${offer.minOrderValue}`
      };
    }

    setActivePromo(offer);
    return { success: true, message: `Promo "${offer.code}" applied!` };
  };

  const removePromoCode = () => {
    setActivePromo(null);
    showToast('Promo code removed', 'info');
  };

  // ORDERS & CHECKOUT
  const createOrder = async (
    customer: { name: string; email: string; phone?: string; address: string },
    userToken: string,
    paymentInfo?: {
      method?: 'cod' | 'upi' | 'razorpay' | 'payu' | 'whatsapp';
      status?: 'pending' | 'paid';
      upiRefNumber?: string;
      upiCheckoutReference?: string;
      policyConsent?: OrderPolicyConsentRequest;
      upiPaymentAttested?: boolean;
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
    }
  ): Promise<Order | null> => {
    if (cart.length === 0) return null;

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
    const shippingAmount = subtotal === 0 || subtotal >= freeShippingThreshold ? 0 : (settings.shippingFee ?? 40);

    const orderPayload: OrderCreatePayload = {
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
      },
      items: cart.map(item => ({
        productId: item.product.id,
        productTitle: item.product.title,
        price: item.product.price,
        quantity: item.quantity,
        image: item.product.image
      })),
      subtotal,
      discountAmount: Number(discount.toFixed(2)),
      shippingAmount,
      promoCodeApplied: activePromo?.code,
      total: Number(Math.max(subtotal - discount + shippingAmount, 0).toFixed(2)),
      paymentMethod: paymentInfo?.method || 'cod',
      paymentStatus: paymentInfo?.status || (paymentInfo?.method === 'cod' ? 'pending' : 'pending'),
      upiRefNumber: paymentInfo?.upiRefNumber,
      upiCheckoutReference: paymentInfo?.method === 'upi' ? paymentInfo.upiCheckoutReference : undefined,
      policyConsent: paymentInfo?.policyConsent,
      upiPaymentAttested: paymentInfo?.method === 'upi' ? paymentInfo.upiPaymentAttested : undefined,
      razorpayOrderId: paymentInfo?.razorpayOrderId,
      razorpayPaymentId: paymentInfo?.razorpayPaymentId,
      status: 'pending'
    };

    try {
      const placedOrder = await api.createOrder(orderPayload, userToken);
      setOrders(prev => [placedOrder, ...prev]);

      // Refresh product stock
      const refreshedProducts = await api.getProducts();
      setProducts(refreshedProducts);

      clearCart();
      setActivePromo(null);
      showToast(`Order #${placedOrder.id} placed successfully! 🌸`);
      return placedOrder;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to record order', 'error');
      return null;
    }
  };

  const updateOrderStatus = async (
    orderId: string, 
    status: Order['status'], 
    extras?: { 
      trackingNumber?: string; 
      paymentStatus?: Order['paymentStatus'];
      courierPartner?: string;
      cancelReason?: string;
      deliveryNotes?: string;
    }
  ) => {
    try {
      const updated = await api.updateOrderStatus(orderId, status, extras);
      setOrders(prev => prev.map(o => (o.id === orderId ? updated : o)));
      
      // If cancelled, inventory was returned to stock, so refresh storefront product counts
      if (status === 'cancelled') {
        void api.getProducts().then(setProducts).catch(() => undefined);
      }

      const statusLabels: Record<string, string> = {
        pending: 'Pending Review',
        confirmed: 'Confirmed (Ready to Ship)',
        processing: 'In Crafting',
        shipped: 'Shipped',
        out_for_delivery: 'Out for Delivery',
        delivered: 'Delivered',
        cancelled: 'Cancelled'
      };
      const isUpiPaymentVerification = extras?.paymentStatus === 'paid' &&
        orders.some(order => order.id === orderId && order.paymentMethod === 'upi');
      showToast(
        isUpiPaymentVerification
          ? `UPI payment for order #${orderId} verified successfully.`
          : `Order #${orderId} marked as ${statusLabels[status] || status}`,
        status === 'cancelled' ? 'info' : 'success'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update order status';
      showToast(msg, 'error');
    }
  };

  const syncOrder = (order: Order) => {
    setOrders(prev => prev.some(existing => existing.id === order.id)
      ? prev.map(existing => existing.id === order.id ? order : existing)
      : [order, ...prev]);
    void api.getProducts().then(setProducts).catch(() => undefined);
  };

  // REVIEWS
  const submitReview = async (
    productId: string, 
    rating: number, 
    comment: string, 
    customerName?: string, 
    customerEmail?: string
  ): Promise<Review> => {
    const review = await api.addReview({
      productId,
      rating,
      comment,
      customerName: customerName || 'Verified Patron',
      customerEmail: customerEmail || ''
    });
    // Refresh products so the updated rating & reviews count reflect in UI
    const refreshed = await api.getProducts();
    setProducts(refreshed);
    if (selectedProductForModal?.id === productId) {
      const updatedModalProd = refreshed.find(p => p.id === productId);
      if (updatedModalProd) setSelectedProductForModal(updatedModalProd);
    }
    showToast('Thank you! Your verified review was published. 🌸');
    return review;
  };

  return (
    <StoreContext.Provider
      value={{
        settings,
        products,
        offers,
        orders,
        cart,
        activePromo,
        viewMode,
        dashboardTab,
        searchQuery,
        selectedCategory,
        isCartOpen,
        selectedProductForModal,
        selectedOfferForModal,
        toastMessage,
        isLoading,
        isAdmin,
        adminRole,
        isAdminLoginModalOpen,
        isTrackingModalOpen,
        activeInvoiceOrder,
        deliveryOrders,
        setDeliveryOrders,

        setIsAdminLoginModalOpen,
        setIsTrackingModalOpen,
        setActiveInvoiceOrder,
        adminLogin,
        deliveryAgentLogin,
        adminLogout,
        setViewMode,
        setDashboardTab,
        setSearchQuery,
        setSelectedCategory,
        setIsCartOpen,
        setCartOwner,
        setSelectedProductForModal: setProductModal,
        setSelectedOfferForModal: setOfferModal,
        showToast,

        updateSettings,
        addProduct,
        updateProduct,
        deleteProduct,

        addOffer,
        updateOffer,
        deleteOffer,
        toggleOfferStatus,

        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        applyPromoCode,
        removePromoCode,

        createOrder,
        syncOrder,
        updateOrderStatus,
        submitReview,
        refreshData,
        resetDatabase: async () => {
          clearCart();
          showToast('Database reset is maintained via SQLite WAL backup.', 'info');
        },
        loadSampleTemplate: async () => {
          await refreshData();
          showToast('Catalog refreshed from SQLite database.');
        }
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};

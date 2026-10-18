import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Product, Offer, Order, CartItem, ViewMode, DashboardTab, StoreSettings, Review } from '../types';
import { api } from '../services/api';

const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'Cozy Loops by Deepa',
  storeTagline: 'Cozy, Handmade Happiness • Premium Crochet Hair Accessories',
  heroBadge: '🌸 100% Handcrafted with Love',
  heroTitle: 'Cozy Loops by Deepa',
  heroSubtitle: '100% handmade with love. Big flower rose ponytail holders, sunny clips, and handcrafted floral accessories.',
  announcementText: '100% Handmade with Love 🌸 Free Shipping on orders above ₹299',
  currency: '₹',
  freeShippingThreshold: 299,
  shippingFee: 40,
  lowStockThreshold: 5,
  contactEmail: 'dsoni7018@gmail.com',
  contactPhone: '+91 98765 43210',
  instagramHandle: '@cozyloopsbydeepa',
  studioLocation: 'Handcrafted Studio, India',
  heroImage: '',
  adminPasscode: '',
  paymentUpiEnabled: true,
  upiId: 'cozyloops@upi',
  upiPayeeName: 'Deepa Soni (Cozy Loops)',
  paymentCodEnabled: true,
  paymentRazorpayEnabled: false,
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
  toastMessage: { text: string; type: 'success' | 'info' | 'error' } | null;
  isLoading: boolean;
  isAdmin: boolean;
  isAdminLoginModalOpen: boolean;
  isTrackingModalOpen: boolean;
  activeInvoiceOrder: Order | null;

  setIsAdminLoginModalOpen: (open: boolean) => void;
  setIsTrackingModalOpen: (open: boolean) => void;
  setActiveInvoiceOrder: (order: Order | null) => void;
  adminLogin: (passcode: string, superAdmin?: { superAdminId: string; superAdminPassword: string }) => Promise<boolean>;
  adminLogout: () => void;

  setViewMode: (mode: ViewMode) => void;
  setDashboardTab: (tab: DashboardTab) => void;
  setSearchQuery: (q: string) => void;
  setSelectedCategory: (cat: string) => void;
  setIsCartOpen: (open: boolean) => void;
  setSelectedProductForModal: (p: Product | null) => void;
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
    paymentInfo?: {
      method?: 'cod' | 'upi' | 'razorpay' | 'whatsapp';
      status?: 'pending' | 'paid';
      upiRefNumber?: string;
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
    }
  ) => Promise<Order | null>;
  syncOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: Order['status'], extras?: { trackingNumber?: string; paymentStatus?: Order['paymentStatus'] }) => Promise<void>;
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
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('dopamean_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activePromo, setActivePromo] = useState<Offer | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [activeInvoiceOrder, setActiveInvoiceOrder] = useState<Order | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('store');
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const showToast = useCallback((text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(prev => (prev?.text === text ? null : prev));
    }, 4200);
  }, []);

  // Fetch initial data from the configured backend database
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedSettings, fetchedProducts, fetchedOffers, fetchedOrders] = await Promise.all([
        api.getSettings().catch(() => DEFAULT_SETTINGS),
        api.getProducts().catch(() => []),
        api.getOffers().catch(() => []),
        api.getOrders().catch(() => [])
      ]);

      setSettings(fetchedSettings);
      setProducts(fetchedProducts);
      setOffers(fetchedOffers);
      setOrders(fetchedOrders);
    } catch {
      console.warn('Backend loading warning: unable to hydrate storefront data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial data hydration is intentionally triggered here to seed store state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
    void api.verifyAdmin().then(valid => {
      setIsAdmin(valid);
      if (valid) void api.getOrders().then(setOrders).catch(() => setOrders([]));
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

  // Dynamically update theme color across the whole application
  useEffect(() => {
    if (settings.themeColor) {
      document.documentElement.style.setProperty('--accent-terracotta', settings.themeColor);
      document.documentElement.style.setProperty('--accent-terracotta-hover', settings.themeColor);
      document.documentElement.style.setProperty('--border-dashed', `${settings.themeColor}55`);
      document.documentElement.style.setProperty('--shadow-glow', `0 0 25px ${settings.themeColor}38`);
    }
  }, [settings.themeColor]);

  // Save cart changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('dopamean_cart', JSON.stringify(cart));
    } catch {
      console.warn('Failed to persist cart: localStorage unavailable');
    }
  }, [cart]);

  // Super Admin login / logout
  const adminLogin = async (passcode: string, superAdmin?: { superAdminId: string; superAdminPassword: string }): Promise<boolean> => {
    try {
      let result;
      if (superAdmin) {
        // Two-tier: use backend super-admin check
        result = await api.superAdminLogin(superAdmin.superAdminId, superAdmin.superAdminPassword);
      } else {
        // Regular admin: passcode check
        result = await api.adminLogin(passcode);
      }
      if (result?.success) {
        const authenticatedOrders = await api.getOrders();
        setIsAdmin(true);
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
      return false;
    }
  };

  const adminLogout = () => {
    setIsAdmin(false);
    api.adminLogout();
    setOrders([]);
    setViewMode('store');
    showToast('Signed out of Admin mode', 'info');
  };

  // SETTINGS
  const updateSettings = async (newSettings: Partial<StoreSettings>) => {
    try {
      const updated = await api.updateSettings(newSettings);
      setSettings(updated);
      showToast('Store settings updated successfully! ✨');
    } catch {
      showToast('Failed to update settings', 'error');
      throw new Error('Failed to update settings');
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
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
    setIsCartOpen(true);
    showToast(`Added ${quantity}x "${product.title}" to cart! 🧶`);
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev
        .map(item => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
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
    paymentInfo?: {
      method?: 'cod' | 'upi' | 'razorpay' | 'whatsapp';
      status?: 'pending' | 'paid';
      upiRefNumber?: string;
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

    const orderPayload: Partial<Order> = {
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
      razorpayOrderId: paymentInfo?.razorpayOrderId,
      razorpayPaymentId: paymentInfo?.razorpayPaymentId,
      status: 'pending'
    };

    try {
      const placedOrder = await api.createOrder(orderPayload);
      setOrders(prev => [placedOrder, ...prev]);

      // Refresh product stock
      const refreshedProducts = await api.getProducts();
      setProducts(refreshedProducts);

      clearCart();
      setActivePromo(null);
      showToast(`Order #${placedOrder.id} placed successfully! 🌸`);
      return placedOrder;
    } catch {
      showToast('Failed to record order', 'error');
      return null;
    }
  };

  const updateOrderStatus = async (
    orderId: string, 
    status: Order['status'], 
    extras?: { trackingNumber?: string; paymentStatus?: Order['paymentStatus'] }
  ) => {
    try {
      const updated = await api.updateOrderStatus(orderId, status, extras);
      setOrders(prev => prev.map(o => (o.id === orderId ? updated : o)));
      showToast(`Order #${orderId} updated to ${status}`);
    } catch {
      showToast('Failed to update status', 'error');
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
        toastMessage,
        isLoading,
        isAdmin,
        isAdminLoginModalOpen,
        isTrackingModalOpen,
        activeInvoiceOrder,

        setIsAdminLoginModalOpen,
        setIsTrackingModalOpen,
        setActiveInvoiceOrder,
        adminLogin,
        adminLogout,
        setViewMode,
        setDashboardTab,
        setSearchQuery,
        setSelectedCategory,
        setIsCartOpen,
        setSelectedProductForModal,
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
        refreshData: loadData,
        resetDatabase: async () => {
          clearCart();
          showToast('Database reset is maintained via SQLite WAL backup.', 'info');
        },
        loadSampleTemplate: async () => {
          await loadData();
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

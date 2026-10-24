import type {
  DeliveryChargeQuote,
  Product,
  Offer,
  Order,
  OrderCreatePayload,
  StoreSettings,
  Review,
  UserProfile
} from '../types';

declare const __DOPAMEAN_API_BASE_URL__: string;

const BASE_URL = import.meta.env.MODE === 'development'
  ? ''
  : __DOPAMEAN_API_BASE_URL__.replace(/\/+$/, '');

export const getAssetUrl = (url?: string | null): string => {
  if (!url || !url.startsWith('/uploads/')) return url || '';
  return `${BASE_URL}${url}`;
};

const adminFetch = (url: string, init: RequestInit = {}) => {
  const token = sessionStorage.getItem('dopamean_admin_token');
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
};

// Uses whichever authenticated token is present (admin or delivery)
const authFetch = (url: string, init: RequestInit = {}) => {
  const token = sessionStorage.getItem('dopamean_admin_token') || sessionStorage.getItem('dopamean_delivery_token');
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
};


export const api = {
  // SETTINGS
  getSettings: async (): Promise<StoreSettings> => {
    const res = await fetch(`${BASE_URL}/api/settings`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  getDeliveryQuote: async (
    pincode: string,
    subtotal: number,
    signal?: AbortSignal
  ): Promise<DeliveryChargeQuote | null> => {
    const params = new URLSearchParams({ pincode, subtotal: String(subtotal) });
    const res = await fetch(`${BASE_URL}/api/delivery/quote?${params.toString()}`, { signal });
    if (res.status === 404) return null;
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to calculate the delivery charge.');
    }
    return res.json();
  },

  updateSettings: async (settings: Partial<StoreSettings> & { clearPayuCredentials?: boolean }): Promise<StoreSettings> => {
    const res = await adminFetch(`${BASE_URL}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update settings');
    }
    const data = await res.json();
    if (data.newToken) {
      sessionStorage.setItem('dopamean_admin_token', data.newToken);
    }
    return data;
  },

  // PRODUCTS
  getProducts: async (): Promise<Product[]> => {
    const res = await fetch(`${BASE_URL}/api/products`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  },

  getProductById: async (id: string): Promise<Product> => {
    const res = await fetch(`${BASE_URL}/api/products/${id}`);
    if (!res.ok) throw new Error('Failed to fetch product');
    return res.json();
  },

  addProduct: async (productData: Omit<Product, 'id' | 'createdAt' | 'rating' | 'reviewsCount'>): Promise<Product> => {
    const res = await adminFetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });
    if (!res.ok) throw new Error('Failed to add product');
    return res.json();
  },

  updateProduct: async (id: string, updates: Partial<Product>): Promise<Product> => {
    const res = await adminFetch(`${BASE_URL}/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update product');
    return res.json();
  },

  deleteProduct: async (id: string): Promise<boolean> => {
    const res = await adminFetch(`${BASE_URL}/api/products/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete product');
    return true;
  },

  // OFFERS
  getOffers: async (): Promise<Offer[]> => {
    const res = await fetch(`${BASE_URL}/api/offers`);
    if (!res.ok) throw new Error('Failed to fetch offers');
    return res.json();
  },

  addOffer: async (offerData: Omit<Offer, 'id'>): Promise<Offer> => {
    const res = await adminFetch(`${BASE_URL}/api/offers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(offerData)
    });
    if (!res.ok) throw new Error('Failed to add offer');
    return res.json();
  },

  updateOffer: async (id: string, updates: Partial<Offer>): Promise<Offer> => {
    const res = await adminFetch(`${BASE_URL}/api/offers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update offer');
    return res.json();
  },

  deleteOffer: async (id: string): Promise<boolean> => {
    const res = await adminFetch(`${BASE_URL}/api/offers/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete offer');
    return true;
  },

  toggleOfferStatus: async (id: string): Promise<Offer> => {
    const res = await adminFetch(`${BASE_URL}/api/offers/${id}/toggle`, {
      method: 'PATCH'
    });
    if (!res.ok) throw new Error('Failed to toggle offer status');
    return res.json();
  },

  // ORDERS & TRACKING
  getOrders: async (): Promise<Order[]> => {
    const res = await adminFetch(`${BASE_URL}/api/orders`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch orders');
    return res.json();
  },

  getOrderById: async (id: string): Promise<Order> => {
    const res = await adminFetch(`${BASE_URL}/api/orders/${id}`);
    if (!res.ok) throw new Error('Failed to fetch order');
    return res.json();
  },

  trackOrder: async (query: string, email: string): Promise<Order[]> => {
    const params = new URLSearchParams({ q: query, email });
    const res = await fetch(`${BASE_URL}/api/orders/track/lookup?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'No order found. Check the ID and checkout email.');
    }
    return res.json();
  },

  createOrder: async (orderData: OrderCreatePayload, userToken: string): Promise<Order> => {
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify(orderData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create order');
    }
    return res.json();
  },

  uploadUpiPaymentProof: async (orderId: string, file: File, userToken: string): Promise<Order> => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${BASE_URL}/api/orders/${encodeURIComponent(orderId)}/payment-proof`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to upload payment screenshot');
    }
    return res.json();
  },

  getUpiPaymentProof: async (orderId: string): Promise<Blob> => {
    const res = await adminFetch(`${BASE_URL}/api/orders/${encodeURIComponent(orderId)}/payment-proof`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to load payment screenshot');
    }
    return res.blob();
  },

  updateOrderStatus: async (
    orderId: string, 
    status: Order['status'], 
    extras?: { 
      trackingNumber?: string; 
      paymentStatus?: Order['paymentStatus'];
      courierPartner?: string;
      cancelReason?: string;
      deliveryNotes?: string;
    }
  ): Promise<Order> => {
    const res = await adminFetch(`${BASE_URL}/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...extras })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update order status');
    }
    return res.json();
  },

  cancelOrder: async (orderId: string, cancelReason?: string): Promise<Order> => {
    const res = await adminFetch(`${BASE_URL}/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancelReason })
    });
    if (res.ok) return res.json();
    if (res.status !== 404 && res.status !== 405) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to cancel order');
    }
    return api.updateOrderStatus(orderId, 'cancelled', { cancelReason });
  },

  // REVIEWS & RATINGS
  getReviews: async (productId: string): Promise<Review[]> => {
    const res = await fetch(`${BASE_URL}/api/reviews/${productId}`);
    if (!res.ok) throw new Error('Failed to fetch reviews');
    return res.json();
  },

  addReview: async (reviewData: {
    productId: string;
    customerName: string;
    customerEmail?: string;
    rating: number;
    comment: string;
  }): Promise<Review> => {
    const res = await fetch(`${BASE_URL}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reviewData)
    });
    if (!res.ok) throw new Error('Failed to post review');
    return res.json();
  },

  deleteReview: async (id: string): Promise<boolean> => {
    const res = await adminFetch(`${BASE_URL}/api/reviews/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete review');
    return true;
  },

  // PAYMENTS (PAYU & RAZORPAY)
  createPayuCheckout: async (data: {
    customer: Order['customer'];
    items: Order['items'];
    subtotal: number;
    discountAmount?: number;
    promoCodeApplied?: string;
    policyConsent: { accepted: true; policyVersion: number };
    userToken: string;
  }): Promise<{ success: boolean; orderId: string; checkoutUrl: string; fields: Record<string, string> }> => {
    const res = await fetch(`${BASE_URL}/api/payments/payu/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.userToken}` },
      body: JSON.stringify({
        customer: data.customer,
        items: data.items,
        subtotal: data.subtotal,
        discountAmount: data.discountAmount,
        promoCodeApplied: data.promoCodeApplied,
        policyConsent: data.policyConsent
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to initiate PayU payment');
    }
    return res.json();
  },

  createRazorpayOrder: async (data: {
    orderId: string;
    userToken: string;
  }): Promise<{ success: boolean; orderId: string; storeOrderId: string; amount: number; currency: string; keyId: string }> => {
    const res = await fetch(`${BASE_URL}/api/payments/razorpay/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.userToken}` },
      body: JSON.stringify({ orderId: data.orderId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to initiate Razorpay payment');
    }
    return res.json();
  },

  verifyRazorpayPayment: async (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    orderId?: string;
    userToken: string;
  }): Promise<{ success: boolean; paymentId: string; order: Order }> => {
    const res = await fetch(`${BASE_URL}/api/payments/razorpay/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.userToken}` },
      body: JSON.stringify({
        razorpay_order_id: data.razorpay_order_id,
        razorpay_payment_id: data.razorpay_payment_id,
        razorpay_signature: data.razorpay_signature,
        orderId: data.orderId
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Payment verification failed');
    }
    return res.json();
  },

  cancelRazorpayOrder: async (orderId: string, userToken: string): Promise<Order> => {
    const res = await fetch(`${BASE_URL}/api/orders/${encodeURIComponent(orderId)}/cancel-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    if (!res.ok) throw new Error('Unable to release the reserved stock for this payment.');
    return res.json();
  },

  testRazorpaySettings: async (): Promise<{ success: boolean }> => {
    const res = await adminFetch(`${BASE_URL}/api/payments/razorpay/test`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Could not verify Razorpay credentials');
    }
    return res.json();
  },

  // ADMIN AUTH
  adminLogin: async (passcode: string): Promise<{ success: boolean; token: string; role: string }> => {
    const res = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Authentication failed');
    }
    const result = await res.json();
    sessionStorage.setItem('dopamean_admin_token', result.token);
    return result;
  },

  superAdminLogin: async (superAdminId: string, superAdminPassword: string): Promise<{ success: boolean; token: string; role: string }> => {
    const res = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ superAdminId, superAdminPassword })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Authentication failed');
    }
    const result = await res.json();
    sessionStorage.setItem('dopamean_admin_token', result.token);
    return result;
  },

  verifyAdmin: async (): Promise<boolean> => {
    const token = sessionStorage.getItem('dopamean_admin_token');
    if (!token) return false;
    try {
      const res = await fetch(`${BASE_URL}/api/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      if (!res.ok) return false;
      const result = await res.json();
      if (!result.valid) sessionStorage.removeItem('dopamean_admin_token');
      return Boolean(result.valid);
    } catch {
      return false;
    }
  },

  adminLogout: () => {
    sessionStorage.removeItem('dopamean_admin_token');
    sessionStorage.removeItem('dopamean_delivery_token');
  },

  // DELIVERY AGENT AUTH
  deliveryAgentLogin: async (passcode: string): Promise<{ success: boolean; token: string; role: string }> => {
    const res = await fetch(`${BASE_URL}/api/delivery/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Authentication failed');
    }
    const result = await res.json();
    sessionStorage.setItem('dopamean_delivery_token', result.token);
    return result;
  },

  deliveryLogout: () => {
    sessionStorage.removeItem('dopamean_delivery_token');
  },

  getDeliveryOrders: async (): Promise<import('../types').Order[]> => {
    const res = await authFetch(`${BASE_URL}/api/delivery/orders`);
    if (!res.ok) throw new Error('Failed to fetch delivery orders');
    return res.json();
  },

  updateDeliveryOrderStatus: async (
    orderId: string,
    status: 'out_for_delivery' | 'delivered',
    extras?: { deliveryNotes?: string; trackingNumber?: string }
  ): Promise<import('../types').Order> => {
    const res = await authFetch(`${BASE_URL}/api/delivery/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...extras })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update delivery status');
    }
    return res.json();
  },

  // USER AUTH
  userRegister: async (data: { name: string; email: string; password: string; phone?: string; address?: string; city?: string; pincode?: string }): Promise<{ success: boolean; token: string; user: UserProfile }> => {
    const res = await fetch(`${BASE_URL}/api/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Registration failed');
    }
    return res.json();
  },

  userLogin: async (email: string, password: string): Promise<{ success: boolean; token: string; user: UserProfile }> => {
    const res = await fetch(`${BASE_URL}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Login failed');
    }
    return res.json();
  },

  getMe: async (token: string): Promise<UserProfile> => {
    const res = await fetch(`${BASE_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Could not load your customer profile. Please try again.');
    }
    return res.json();
  },

  updateMe: async (token: string, updates: Partial<UserProfile> & { password?: string; currentPassword?: string }): Promise<UserProfile> => {
    const res = await fetch(`${BASE_URL}/api/users/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Update failed');
    }
    return res.json();
  },

  getMyOrders: async (token: string): Promise<Order[]> => {
    const res = await fetch(`${BASE_URL}/api/users/my-orders`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch orders');
    return res.json();
  },

  // IMAGE UPLOAD
  uploadImage: async (
    file: File,
    purpose: 'product' | 'offer' | 'storefront' | 'payment-qr'
  ): Promise<string> => {
    const maxBytes = purpose === 'product'
      ? 300 * 1024
      : purpose === 'offer'
        ? 1024 * 1024
        : 5 * 1024 * 1024;
    const limitLabel = purpose === 'product' ? '300 KB' : purpose === 'offer' ? '1 MB' : '5 MB';
    if (file.size > maxBytes) {
      throw new Error(`Image must be ${limitLabel} or smaller.`);
    }
    const formData = new FormData();
    formData.append('purpose', purpose);
    formData.append('image', file);
    const res = await adminFetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => null) as { error?: unknown } | null;
      throw new Error(typeof errorData?.error === 'string' ? errorData.error : 'Failed to upload image');
    }

    const data = await res.json() as { url?: unknown; storage?: unknown };
    const uploadedUrl = data.url;
    if (typeof uploadedUrl !== 'string' || !uploadedUrl) {
      throw new Error('Image upload did not return an image URL.');
    }
    if (import.meta.env.PROD) {
      const isPublicStorageUrl = (() => {
        try {
          const imageUrl = new URL(uploadedUrl);
          return imageUrl.protocol === 'https:' &&
            imageUrl.pathname.includes('/storage/v1/object/public/');
        } catch {
          return false;
        }
      })();
      if (data.storage !== 'supabase' || !isPublicStorageUrl) {
        throw new Error('Image upload did not return a public Supabase Storage URL.');
      }
    }
    return uploadedUrl;
  },

  deleteImage: async (url: string): Promise<{ deleted: boolean; managed: boolean; referenced: boolean }> => {
    const res = await adminFetch(`${BASE_URL}/api/images`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => null) as { error?: unknown } | null;
      throw new Error(typeof errorData?.error === 'string' ? errorData.error : 'Could not clean up the unused image.');
    }
    return res.json();
  }
};

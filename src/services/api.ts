import type { Product, Offer, Order, StoreSettings, Review, UserProfile } from '../types';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';

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

  updateSettings: async (settings: Partial<StoreSettings>): Promise<StoreSettings> => {
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
    const res = await fetch(`${BASE_URL}/api/products`);
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
    const res = await adminFetch(`${BASE_URL}/api/orders`);
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

  createOrder: async (orderData: Partial<Order>): Promise<Order> => {
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create order');
    }
    return res.json();
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
    try {
      const res = await adminFetch(`${BASE_URL}/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelReason })
      });
      if (res.ok) return res.json();
    } catch {}
    // Fallback to updateOrderStatus
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

  // PAYMENTS (RAZORPAY)
  createRazorpayOrder: async (data: {
    orderId: string;
  }): Promise<{ success: boolean; orderId: string; storeOrderId: string; amount: number; currency: string; keyId: string }> => {
    const res = await fetch(`${BASE_URL}/api/payments/razorpay/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
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
  }): Promise<{ success: boolean; paymentId: string; order: Order }> => {
    const res = await fetch(`${BASE_URL}/api/payments/razorpay/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Payment verification failed');
    }
    return res.json();
  },

  cancelRazorpayOrder: async (orderId: string): Promise<Order> => {
    const res = await fetch(`${BASE_URL}/api/orders/${encodeURIComponent(orderId)}/cancel-payment`, { method: 'POST' });
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
    if (!res.ok) throw new Error('Not authenticated');
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
  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await adminFetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Failed to upload image');
    const data = await res.json();
    return data.url;
  }
};

import type { Product, Offer, Order, StoreSettings, Review } from '../types';

const BASE_URL = '';

export const api = {
  // SETTINGS
  getSettings: async (): Promise<StoreSettings> => {
    const res = await fetch(`${BASE_URL}/api/settings`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  updateSettings: async (settings: Partial<StoreSettings>): Promise<StoreSettings> => {
    const res = await fetch(`${BASE_URL}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
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
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });
    if (!res.ok) throw new Error('Failed to add product');
    return res.json();
  },

  updateProduct: async (id: string, updates: Partial<Product>): Promise<Product> => {
    const res = await fetch(`${BASE_URL}/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update product');
    return res.json();
  },

  deleteProduct: async (id: string): Promise<boolean> => {
    const res = await fetch(`${BASE_URL}/api/products/${id}`, {
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
    const res = await fetch(`${BASE_URL}/api/offers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(offerData)
    });
    if (!res.ok) throw new Error('Failed to add offer');
    return res.json();
  },

  updateOffer: async (id: string, updates: Partial<Offer>): Promise<Offer> => {
    const res = await fetch(`${BASE_URL}/api/offers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update offer');
    return res.json();
  },

  deleteOffer: async (id: string): Promise<boolean> => {
    const res = await fetch(`${BASE_URL}/api/offers/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete offer');
    return true;
  },

  toggleOfferStatus: async (id: string): Promise<Offer> => {
    const res = await fetch(`${BASE_URL}/api/offers/${id}/toggle`, {
      method: 'PATCH'
    });
    if (!res.ok) throw new Error('Failed to toggle offer status');
    return res.json();
  },

  // ORDERS & TRACKING
  getOrders: async (): Promise<Order[]> => {
    const res = await fetch(`${BASE_URL}/api/orders`);
    if (!res.ok) throw new Error('Failed to fetch orders');
    return res.json();
  },

  getOrderById: async (id: string): Promise<Order> => {
    const res = await fetch(`${BASE_URL}/api/orders/${id}`);
    if (!res.ok) throw new Error('Failed to fetch order');
    return res.json();
  },

  trackOrder: async (query: string): Promise<Order[]> => {
    const res = await fetch(`${BASE_URL}/api/orders/track/lookup?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'No orders found matching that Order ID or Phone number');
    }
    return res.json();
  },

  createOrder: async (orderData: Partial<Order>): Promise<Order> => {
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    if (!res.ok) throw new Error('Failed to create order');
    return res.json();
  },

  updateOrderStatus: async (
    orderId: string, 
    status: Order['status'], 
    extras?: { trackingNumber?: string; paymentStatus?: string }
  ): Promise<Order> => {
    const res = await fetch(`${BASE_URL}/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...extras })
    });
    if (!res.ok) throw new Error('Failed to update order status');
    return res.json();
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
    const res = await fetch(`${BASE_URL}/api/reviews/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete review');
    return true;
  },

  // PAYMENTS (RAZORPAY)
  createRazorpayOrder: async (data: {
    amount: number;
    currency?: string;
    receipt?: string;
    notes?: Record<string, string | number | boolean | null | undefined>;
  }): Promise<{ success: boolean; orderId: string; amount: number; currency: string; keyId: string }> => {
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
  }): Promise<{ success: boolean; paymentId: string }> => {
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

  // ADMIN AUTH
  adminLogin: async (passcode: string): Promise<{ success: boolean; token: string }> => {
    const res = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Authentication failed');
    }
    return res.json();
  },

  // IMAGE UPLOAD
  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Failed to upload image');
    const data = await res.json();
    return data.url;
  }
};

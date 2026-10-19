export interface StoreSettings {
  storeName: string;
  storeTagline: string;
  heroBadge?: string;
  heroTitle: string;
  heroSubtitle: string;
  heroPrimaryBtnText?: string;
  heroSecondaryBtnText?: string;
  heroImage: string;
  
  showAnnouncement?: boolean;
  announcementText: string;
  
  themeColor?: string;
  
  // Maker Story / About the Artisan
  showAboutSection?: boolean;
  aboutBadge?: string;
  aboutTitle?: string;
  aboutStory1?: string;
  aboutStory2?: string;
  aboutQuote?: string;
  aboutImage?: string;
  
  // 4 Studio Value Highlights / Trust Badges
  trustBadge1Icon?: string;
  trustBadge1Title?: string;
  trustBadge1Desc?: string;

  trustBadge2Icon?: string;
  trustBadge2Title?: string;
  trustBadge2Desc?: string;

  trustBadge3Icon?: string;
  trustBadge3Title?: string;
  trustBadge3Desc?: string;

  trustBadge4Icon?: string;
  trustBadge4Title?: string;
  trustBadge4Desc?: string;

  // Logistics & Currency
  currency: string;
  freeShippingThreshold: number;
  shippingFee: number;
  lowStockThreshold: number;
  shippingNotice?: string;
  
  // Contact & Socials
  contactEmail: string;
  contactPhone: string;
  instagramHandle: string;
  studioLocation: string;
  
  // Footer
  footerAboutText?: string;
  footerCopyright?: string;
  
  // Security
  adminPasscode?: string;

  // Studio Orders & Commission Tracking Settings
  artisanCommissionRate?: number;
  commissionType?: 'percentage' | 'fixed';
  defaultCourierPartner?: string;
  estimatedCraftingDays?: number;
  autoMarkCodPaidOnDelivered?: boolean;
  enableWhatsAppUpdates?: boolean;

  // Payment Gateways & UPI
  paymentRazorpayEnabled?: boolean;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  razorpayKeySecretConfigured?: boolean;
  razorpayWebhookSecret?: string;
  razorpayWebhookSecretConfigured?: boolean;
  paymentUpiEnabled?: boolean;
  upiId?: string;
  upiPayeeName?: string;
  paymentCodEnabled?: boolean;
  paymentPayuEnabled?: boolean;
  payuMerchantKey?: string;
  payuMerchantSalt?: string;
}

export interface Product {
  id: string;
  title: string;
  tagline?: string;
  category: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewsCount: number;
  stock: number;
  image: string;
  secondaryImages?: string[];
  yarnType: string;
  craftTimeHours: number;
  careInstructions: string;
  description: string;
  tags: string[];
  isFeatured?: boolean;
  isBestSeller?: boolean;
  maxOrderQuantity?: number;
  createdAt: string;
}

export interface Review {
  id: string;
  productId: string;
  customerName: string;
  customerEmail?: string;
  rating: number;
  comment: string;
  verifiedPurchase: boolean;
  createdAt: string;
}

export interface Offer {
  id: string;
  title: string;
  description: string;
  badge: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderValue?: number;
  image: string;
  startDate?: string;
  endDate: string;
  isActive: boolean;
  accentColor?: string;
  highlightCategory?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedColor?: string;
}

export interface OrderItem {
  productId: string;
  productTitle: string;
  price: number;
  quantity: number;
  image: string;
  color?: string;
}

export interface OrderTimelineEvent {
  status: string;
  timestamp: string;
  note?: string;
}

export interface Order {
  id: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    pincode?: string;
  };
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  shippingAmount?: number;
  promoCodeApplied?: string;
  total: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled';
  paymentMethod?: 'cod' | 'upi' | 'razorpay' | 'whatsapp';
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refund_pending' | 'refunded';
  trackingNumber?: string;
  courierPartner?: string;
  cancelReason?: string;
  cancelledAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  deliveryNotes?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  upiRefNumber?: string;
  timeline?: OrderTimelineEvent[];
  createdAt: string;
}

export type ViewMode = 'store' | 'dashboard';
export type DashboardTab = 'overview' | 'products' | 'offers' | 'orders' | 'settings';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  pincode?: string;
  createdAt?: string;
  updatedAt?: string;
}


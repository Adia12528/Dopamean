export interface StorePolicies {
  termsAndConditions: string;
  refundReturnPolicy: string;
  privacyPolicy: string;
  shippingPolicy: string;
}

export interface OrderPolicyConsent {
  policyVersion: number;
  acceptedAt: string;
  policySnapshot: StorePolicies;
  upiPaymentAttestedAt?: string;
}

export interface OrderPolicyConsentRequest {
  accepted: true;
  policyVersion: number;
}

export type OrderCreatePayload = Omit<Partial<Order>, 'policyConsent'> & {
  policyConsent?: OrderPolicyConsentRequest;
  upiPaymentAttested?: boolean;
};

export interface StoreSettings {
  storeName: string;
  storeTagline: string;
  heroBadge?: string;
  heroTitle: string;
  heroSubtitle: string;
  heroPrimaryBtnText?: string;
  heroSecondaryBtnText?: string;
  heroImage: string;
  showHeroSocialProof?: boolean;
  showHeroOfferHighlight?: boolean;
  showHeroPersonalGreeting?: boolean;
  showHeroInstagramStrip?: boolean;
  enableHeroParallax?: boolean;
  introSplashEnabled?: boolean;
  introSplashDurationMs?: number;
  categoryTopStockPreviewCount?: number;
  categoryOtherPreviewCount?: number;
  categoryProductSortOrder?: 'bestseller-newest' | 'newest-bestseller';
  showLaunchRail?: boolean;
  launchRailProductsLimit?: number;
  launchRailProductSortOrder?: 'newest' | 'bestselling';
  
  showAnnouncement?: boolean;
  announcementText: string;
  
  themeColor?: string;
  
  // Maker Story / About the Artisan
  showAboutSection?: boolean;
  showTestimonialsSection?: boolean;
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
  productCardBadgePriority?: ProductCardBadge[];
  shippingNotice?: string;
  codRules?: CodRule[];
  storePolicies?: StorePolicies;
  storePolicyVersion?: number;
  
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
  superAdminId?: string;
  superAdminPassword?: string;
  superAdminConfigured?: boolean;
  adminPasscodeConfigured?: boolean;
  // Delivery Agent
  deliveryAgentPasscode?: string;
  deliveryAgentPasscodeConfigured?: boolean;

  // Studio Orders & Commission Tracking Settings
  artisanCommissionRate?: number;
  commissionType?: 'percentage' | 'fixed';
  defaultCourierPartner?: string;
  estimatedCraftingDays?: number;
  deliveryStagePlacedLabel?: string;
  deliveryStageConfirmedLabel?: string;
  deliveryStageInPreparationLabel?: string;
  deliveryStageShippedLabel?: string;
  deliveryStageOutForDeliveryLabel?: string;
  deliveryStageDeliveredLabel?: string;
  autoMarkCodPaidOnDelivered?: boolean;
  whatsappEnabled?: boolean;
  whatsappBusinessPhone?: string;
  whatsappCountryCode?: string;
  bulkOrderInquiryEnabled?: boolean;
  bulkOrderMinimumQuantity?: number;
  whatsappOrderButtonEnabled?: boolean;
  whatsappOrderReceivedEnabled?: boolean;
  whatsappOrderConfirmedEnabled?: boolean;
  whatsappOrderShippedEnabled?: boolean;
  whatsappOutForDeliveryEnabled?: boolean;
  whatsappOrderDeliveredEnabled?: boolean;
  whatsappOrderCancelledEnabled?: boolean;
  whatsappCodReminderEnabled?: boolean;
  whatsappSupportEnabled?: boolean;
  whatsappTemplateOrderInquiry?: string;
  whatsappTemplateOrderReceived?: string;
  whatsappTemplateConfirmed?: string;
  whatsappTemplateShipped?: string;
  whatsappTemplateOutForDelivery?: string;
  whatsappTemplateDelivered?: string;
  whatsappTemplateCancelled?: string;
  whatsappTemplateCodReminder?: string;
  whatsappTemplateSupport?: string;

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
  upiQrImage?: string;
  paymentCodEnabled?: boolean;
  paymentPayuEnabled?: boolean;
  payuTestMode?: boolean;
  payuMerchantKey?: string;
  payuMerchantSalt?: string;
  payuConfigured?: boolean;
}

export type ProductCardBadge = 'bestseller' | 'discount' | 'lowStock' | 'craftTime';

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
  codAvailability?: 'inherit' | 'enabled' | 'disabled';
  createdAt: string;
}

export interface CodRule {
  id: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  availability: 'enabled' | 'disabled';
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
  paymentMethod?: 'cod' | 'upi' | 'razorpay' | 'payu' | 'whatsapp';
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
  upiCheckoutReference?: string;
  policyConsent?: OrderPolicyConsent;
  paymentProofKey?: string;
  paymentProofStorage?: 'supabase' | 'local';
  timeline?: OrderTimelineEvent[];
  createdAt: string;
}

export type ViewMode = 'store' | 'dashboard' | 'delivery';
export type AdminRole = 'superadmin' | 'admin' | 'delivery_agent' | null;
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

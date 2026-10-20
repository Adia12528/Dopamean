import type { Order, StoreSettings } from '../types';

export type WhatsAppTemplateKey =
  | 'orderInquiry'
  | 'orderReceived'
  | 'confirmed'
  | 'shipped'
  | 'outForDelivery'
  | 'delivered'
  | 'cancelled'
  | 'codReminder'
  | 'support';

export type WhatsAppStage =
  | 'orderReceived'
  | 'confirmed'
  | 'shipped'
  | 'outForDelivery'
  | 'delivered'
  | 'cancelled'
  | 'codReminder';

const DEFAULT_TEMPLATES: Record<WhatsAppTemplateKey, string> = {
  orderInquiry: 'Hi! I would like to order from {store}:\n{items}\n{promo}Total: {currency}{total}\nPlease confirm availability. Thank you!',
  orderReceived: 'Hello {customer}! We received your order #{orderId} at {store}. Total: {currency}{total}. We will confirm it shortly.',
  confirmed: 'Hello {customer}! Your order #{orderId} at {store} has been confirmed. Estimated dispatch in {craftingDays} days. Thank you!',
  shipped: 'Hello {customer}! Your order #{orderId} from {store} has been dispatched via {courier}. Tracking AWB: {trackingNumber}.',
  outForDelivery: 'Hello {customer}! Your order #{orderId} from {store} is out for delivery today. Amount due: {amountDue}.',
  delivered: 'Hello {customer}! Your order #{orderId} from {store} was delivered. We hope you love it!',
  cancelled: 'Hello {customer}, your order #{orderId} at {store} has been cancelled. Reason: {cancelReason}.',
  codReminder: 'Hello {customer}! Your order #{orderId} from {store} is out for delivery. Please keep {currency}{total} ready for cash on delivery.',
  support: 'Hi, I have a question about order #{orderId}.'
};

const TEMPLATE_SETTING_FIELDS: Record<WhatsAppTemplateKey, keyof StoreSettings> = {
  orderInquiry: 'whatsappTemplateOrderInquiry',
  orderReceived: 'whatsappTemplateOrderReceived',
  confirmed: 'whatsappTemplateConfirmed',
  shipped: 'whatsappTemplateShipped',
  outForDelivery: 'whatsappTemplateOutForDelivery',
  delivered: 'whatsappTemplateDelivered',
  cancelled: 'whatsappTemplateCancelled',
  codReminder: 'whatsappTemplateCodReminder',
  support: 'whatsappTemplateSupport'
};

const STAGE_SETTING_FIELDS: Record<WhatsAppStage, keyof StoreSettings> = {
  orderReceived: 'whatsappOrderReceivedEnabled',
  confirmed: 'whatsappOrderConfirmedEnabled',
  shipped: 'whatsappOrderShippedEnabled',
  outForDelivery: 'whatsappOutForDeliveryEnabled',
  delivered: 'whatsappOrderDeliveredEnabled',
  cancelled: 'whatsappOrderCancelledEnabled',
  codReminder: 'whatsappCodReminderEnabled'
};

export const getWhatsAppTemplate = (settings: StoreSettings, key: WhatsAppTemplateKey) =>
  String(settings[TEMPLATE_SETTING_FIELDS[key]] || DEFAULT_TEMPLATES[key]);

export const renderWhatsAppTemplate = (template: string, variables: Record<string, string>) =>
  template.replace(/\{([A-Za-z]+)\}/g, (match, name: string) => variables[name] ?? match);

export const isWhatsAppEnabled = (settings: StoreSettings) =>
  settings.whatsappEnabled !== false;

export const isWhatsAppSupportEnabled = (settings: StoreSettings) =>
  isWhatsAppEnabled(settings) && settings.whatsappSupportEnabled !== false;

export const isWhatsAppStageEnabled = (settings: StoreSettings, stage: WhatsAppStage) =>
  isWhatsAppEnabled(settings) && settings[STAGE_SETTING_FIELDS[stage]] !== false;

export const normalizeWhatsAppPhone = (phone: string, countryCode = '91') => {
  const digits = phone.replace(/\D/g, '');
  const callingCode = countryCode.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return '';
  if (phone.trim().startsWith('+') || digits.startsWith('00')) {
    return digits.startsWith('00') ? digits.slice(2) : digits;
  }
  if (callingCode && digits.startsWith(callingCode) && digits.length > callingCode.length + 7) return digits;
  return `${callingCode}${digits.replace(/^0+/, '')}`;
};

export const createWhatsAppUrl = (phone: string, message: string, countryCode = '91') => {
  const normalizedPhone = normalizeWhatsAppPhone(phone, countryCode);
  if (!normalizedPhone) return null;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
};

type OrderMessageData = {
  order: Order;
  settings: StoreSettings;
};

const getOrderVariables = ({ order, settings }: OrderMessageData) => ({
  customer: order.customer.name || 'Customer',
  orderId: order.id,
  store: settings.storeName || 'our store',
  currency: settings.currency || '₹',
  total: Number(order.total || 0).toFixed(2),
  craftingDays: String(settings.estimatedCraftingDays || 3),
  courier: order.courierPartner || 'Courier',
  trackingNumber: order.trackingNumber || 'Available shortly',
  amountDue: order.paymentStatus === 'paid' ? 'PAID ONLINE' : `${settings.currency || '₹'}${Number(order.total || 0).toFixed(2)} (Cash on Delivery)`,
  cancelReason: order.cancelReason || 'Cancelled by studio'
});

export const createOrderWhatsAppMessage = (
  { order, settings }: OrderMessageData,
  key: WhatsAppTemplateKey
) => {
  const variables = getOrderVariables({ order, settings });
  return renderWhatsAppTemplate(getWhatsAppTemplate(settings, key), variables);
};

export const createWhatsAppSupportUrl = (order: Order, settings: StoreSettings) => {
  if (!isWhatsAppSupportEnabled(settings)) return null;
  const phone = settings.whatsappBusinessPhone || settings.contactPhone || '';
  const message = createOrderWhatsAppMessage({ order, settings }, 'support');
  return createWhatsAppUrl(phone, message, settings.whatsappCountryCode || '91');
};

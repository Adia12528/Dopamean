import React, { useState, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import { api, getAssetUrl } from '../../services/api';
import { 
  Sliders, 
  Save, 
  Upload, 
  Check, 
  Palette, 
  Sparkles, 
  Image as ImageIcon, 
  Heart, 
  ShieldCheck, 
  Truck, 
  MessageCircle, 
  Lock, 
  Database,
  Eye,
  EyeOff,
  Info,
  CreditCard,
  QrCode,
  User,
  KeyRound,
  ShieldAlert,
  FileText
} from 'lucide-react';
import type { CodRule, DeliveryPricing, ProductCardBadge, StoreSettings } from '../../types';
import { PRODUCT_CARD_BADGES, normalizeProductCardBadgePriority } from '../../lib/productCardBadgePriority';
import { formatDeliveryPrefixRanges, getDeliveryPricing, parseDeliveryPrefixRanges, validateDeliveryPricing } from '../../lib/deliveryPricing';

type HeroDisplaySettingSection = 'heroSocialProof' | 'heroOfferHighlight' | 'heroPersonalGreeting' | 'heroInstagramStrip' | 'heroParallax';
type ScopedSettingSection = 'introSplash' | 'categorySections' | 'launchRail' | 'productCards' | 'lowStock' | 'trustCards' | 'testimonials' | 'deliveryTimeline' | 'deliveryPricing' | 'upi' | 'policies' | 'heroDisplay' | HeroDisplaySettingSection;
type ScopedSettingSaveState = { isSaving: boolean; error: string };
const SCOPED_SETTING_SECTIONS: ScopedSettingSection[] = ['introSplash', 'categorySections', 'launchRail', 'productCards', 'lowStock', 'trustCards', 'testimonials', 'deliveryTimeline', 'deliveryPricing', 'upi', 'policies', 'heroDisplay', 'heroSocialProof', 'heroOfferHighlight', 'heroPersonalGreeting', 'heroInstagramStrip', 'heroParallax'];
const isScopedSettingSection = (section: string): section is ScopedSettingSection =>
  SCOPED_SETTING_SECTIONS.includes(section as ScopedSettingSection);

const isValidUpiVpa = (value: string) =>
  /^[A-Za-z0-9][A-Za-z0-9._-]{1,255}@[A-Za-z][A-Za-z0-9.-]{1,63}$/.test(value.trim());

// Recommended harmonious palettes for artisanal crochet
const COLOR_PRESETS = [
  { name: 'Warm Terracotta (Default)', hex: '#C85A32', preview: '#C85A32' },
  { name: 'Sunflower Gold', hex: '#D97706', preview: '#D97706' },
  { name: 'Rose Petal Red', hex: '#D95D71', preview: '#D95D71' },
  { name: 'Forest Sage Green', hex: '#52796F', preview: '#52796F' },
  { name: 'Velvet Lavender', hex: '#7E57C2', preview: '#7E57C2' },
  { name: 'Dusty Berry Pink', hex: '#BE185D', preview: '#BE185D' },
  { name: 'Royal Indigo', hex: '#2563EB', preview: '#2563EB' }
];

export const StudioSettings: React.FC = () => {
  const { settings, products, updateSettings, resetDatabase, loadSampleTemplate, setViewMode } = useStore();
  const minimumServerPasscodeLength = import.meta.env.PROD ? 12 : 6;
  
  const heroFileInputRef = useRef<HTMLInputElement>(null);
  const aboutFileInputRef = useRef<HTMLInputElement>(null);
  const upiQrFileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(() => ({
    ...settings,
    deliveryPricing: getDeliveryPricing(settings.deliveryPricing, settings.shippingFee ?? 40)
  }));
  const [deliveryPrefixRangeDrafts, setDeliveryPrefixRangeDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries((form.deliveryPricing?.zones ?? []).map(zone => [zone.id, formatDeliveryPrefixRanges(zone.prefixRanges)]))
  );
  const [activeSection, setActiveSection] = useState<'theme' | 'header' | 'hero' | 'heroDisplay' | 'introSplash' | 'categorySections' | 'launchRail' | 'story' | 'testimonials' | 'trustCards' | 'shipping' | 'deliveryPricing' | 'productCards' | 'lowStock' | 'deliveryTimeline' | 'cod' | 'whatsapp' | 'payments' | 'upi' | 'policies' | 'contact' | 'footer' | 'security' | 'db'>('theme');
  const [isHeroUploading, setIsHeroUploading] = useState(false);
  const [isAboutUploading, setIsAboutUploading] = useState(false);
  const [isUpiQrUploading, setIsUpiQrUploading] = useState(false);
  const [upiQrUploadError, setUpiQrUploadError] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [scopedSaveStates, setScopedSaveStates] = useState<Record<ScopedSettingSection, ScopedSettingSaveState>>({
    introSplash: { isSaving: false, error: '' },
    categorySections: { isSaving: false, error: '' },
    launchRail: { isSaving: false, error: '' },
    productCards: { isSaving: false, error: '' },
    lowStock: { isSaving: false, error: '' },
    trustCards: { isSaving: false, error: '' },
    testimonials: { isSaving: false, error: '' },
    deliveryTimeline: { isSaving: false, error: '' },
    deliveryPricing: { isSaving: false, error: '' },
    upi: { isSaving: false, error: '' },
    policies: { isSaving: false, error: '' },
    heroDisplay: { isSaving: false, error: '' },
    heroSocialProof: { isSaving: false, error: '' },
    heroOfferHighlight: { isSaving: false, error: '' },
    heroPersonalGreeting: { isSaving: false, error: '' },
    heroInstagramStrip: { isSaving: false, error: '' },
    heroParallax: { isSaving: false, error: '' }
  });
  const [validationErrors, setValidationErrors] = useState<Partial<Record<'storeName' | 'heroTitle' | 'currency' | 'upiId', string>>>({});
  const [codRuleErrors, setCodRuleErrors] = useState<Record<string, string>>({});
  const normalizedFormBadgePriority = normalizeProductCardBadgePriority(form.productCardBadgePriority);
  const normalizedSavedBadgePriority = normalizeProductCardBadgePriority(settings.productCardBadgePriority);
  const isBadgePriorityDirty = JSON.stringify(normalizedFormBadgePriority) !== JSON.stringify(normalizedSavedBadgePriority);
  const isIntroSplashDirty =
    (form.introSplashEnabled !== false) !== (settings.introSplashEnabled !== false) ||
    Number(form.introSplashDurationMs ?? 2500) !== Number(settings.introSplashDurationMs ?? 2500);
  const isCategorySectionsDirty =
    Number(form.categoryTopStockPreviewCount ?? 4) !== Number(settings.categoryTopStockPreviewCount ?? 4) ||
    Number(form.categoryOtherPreviewCount ?? 2) !== Number(settings.categoryOtherPreviewCount ?? 2) ||
    (form.categoryProductSortOrder || 'bestseller-newest') !== (settings.categoryProductSortOrder || 'bestseller-newest');
  const isLaunchRailDirty =
    (form.showLaunchRail !== false) !== (settings.showLaunchRail !== false) ||
    Number(form.launchRailProductsLimit ?? 6) !== Number(settings.launchRailProductsLimit ?? 6) ||
    (form.launchRailProductSortOrder || 'newest') !== (settings.launchRailProductSortOrder || 'newest');
  const isLowStockThresholdDirty = Number(form.lowStockThreshold ?? 5) !== Number(settings.lowStockThreshold ?? 5);
  const trustCardFormValues = {
    trustBadge1Icon: form.trustBadge1Icon,
    trustBadge1Title: form.trustBadge1Title,
    trustBadge1Desc: form.trustBadge1Desc,
    trustBadge2Icon: form.trustBadge2Icon,
    trustBadge2Title: form.trustBadge2Title,
    trustBadge2Desc: form.trustBadge2Desc,
    trustBadge3Icon: form.trustBadge3Icon,
    trustBadge3Title: form.trustBadge3Title,
    trustBadge3Desc: form.trustBadge3Desc,
    trustBadge4Icon: form.trustBadge4Icon,
    trustBadge4Title: form.trustBadge4Title,
    trustBadge4Desc: form.trustBadge4Desc
  };
  const trustCardSavedValues = {
    trustBadge1Icon: settings.trustBadge1Icon,
    trustBadge1Title: settings.trustBadge1Title,
    trustBadge1Desc: settings.trustBadge1Desc,
    trustBadge2Icon: settings.trustBadge2Icon,
    trustBadge2Title: settings.trustBadge2Title,
    trustBadge2Desc: settings.trustBadge2Desc,
    trustBadge3Icon: settings.trustBadge3Icon,
    trustBadge3Title: settings.trustBadge3Title,
    trustBadge3Desc: settings.trustBadge3Desc,
    trustBadge4Icon: settings.trustBadge4Icon,
    trustBadge4Title: settings.trustBadge4Title,
    trustBadge4Desc: settings.trustBadge4Desc
  };
  const isTrustCardsDirty = JSON.stringify(trustCardFormValues) !== JSON.stringify(trustCardSavedValues);
  const isTestimonialsDirty = (form.showTestimonialsSection === true) !== (settings.showTestimonialsSection === true);
  const isHeroSocialProofDirty = (form.showHeroSocialProof !== false) !== (settings.showHeroSocialProof !== false);
  const isHeroOfferHighlightDirty = (form.showHeroOfferHighlight !== false) !== (settings.showHeroOfferHighlight !== false);
  const isHeroPersonalGreetingDirty = (form.showHeroPersonalGreeting !== false) !== (settings.showHeroPersonalGreeting !== false);
  const isHeroInstagramStripDirty = (form.showHeroInstagramStrip !== false) !== (settings.showHeroInstagramStrip !== false);
  const isHeroParallaxDirty = (form.enableHeroParallax !== false) !== (settings.enableHeroParallax !== false);
  const deliveryTimelineFormValues = {
    deliveryStagePlacedLabel: form.deliveryStagePlacedLabel || 'Order placed',
    deliveryStageConfirmedLabel: form.deliveryStageConfirmedLabel || 'Confirmed',
    deliveryStageInPreparationLabel: form.deliveryStageInPreparationLabel || 'In preparation',
    deliveryStageShippedLabel: form.deliveryStageShippedLabel || 'Shipped',
    deliveryStageOutForDeliveryLabel: form.deliveryStageOutForDeliveryLabel || 'Out for delivery',
    deliveryStageDeliveredLabel: form.deliveryStageDeliveredLabel || 'Delivered'
  };
  const deliveryTimelineSavedValues = {
    deliveryStagePlacedLabel: settings.deliveryStagePlacedLabel || 'Order placed',
    deliveryStageConfirmedLabel: settings.deliveryStageConfirmedLabel || 'Confirmed',
    deliveryStageInPreparationLabel: settings.deliveryStageInPreparationLabel || 'In preparation',
    deliveryStageShippedLabel: settings.deliveryStageShippedLabel || 'Shipped',
    deliveryStageOutForDeliveryLabel: settings.deliveryStageOutForDeliveryLabel || 'Out for delivery',
    deliveryStageDeliveredLabel: settings.deliveryStageDeliveredLabel || 'Delivered'
  };
  const isDeliveryTimelineDirty = JSON.stringify(deliveryTimelineFormValues) !== JSON.stringify(deliveryTimelineSavedValues);
  const deliveryPricingFormValues = getDeliveryPricing(form.deliveryPricing, form.shippingFee ?? 40);
  const deliveryPricingDraftHasInvalidRange = deliveryPricingFormValues.zones.some(zone =>
    parseDeliveryPrefixRanges(deliveryPrefixRangeDrafts[zone.id] ?? '') === null
  );
  const deliveryPricingPayload: DeliveryPricing = {
    ...deliveryPricingFormValues,
    zones: deliveryPricingFormValues.zones.map(zone => ({
      ...zone,
      prefixRanges: parseDeliveryPrefixRanges(deliveryPrefixRangeDrafts[zone.id] ?? '') ?? []
    }))
  };
  const savedDeliveryPricing = getDeliveryPricing(settings.deliveryPricing, settings.shippingFee ?? 40);
  const isDeliveryPricingDirty =
    JSON.stringify(deliveryPricingFormValues) !== JSON.stringify(savedDeliveryPricing) ||
    deliveryPricingFormValues.zones.some(zone =>
      (deliveryPrefixRangeDrafts[zone.id] ?? '') !== formatDeliveryPrefixRanges(zone.prefixRanges)
    );
  const isUpiDetailsDirty = (
    String(form.upiId || '').trim() !== String(settings.upiId || '').trim() ||
    String(form.upiPayeeName || '').trim() !== String(settings.upiPayeeName || '').trim() ||
    (form.upiQrImage || '') !== (settings.upiQrImage || '') ||
    (form.paymentUpiEnabled !== false) !== (settings.paymentUpiEnabled !== false)
  );
  const storePolicyFormValues = {
    termsAndConditions: String(form.storePolicies?.termsAndConditions || ''),
    refundReturnPolicy: String(form.storePolicies?.refundReturnPolicy || ''),
    privacyPolicy: String(form.storePolicies?.privacyPolicy || ''),
    shippingPolicy: String(form.storePolicies?.shippingPolicy || '')
  };
  const savedStorePolicyValues = settings.storePolicies || {
    termsAndConditions: '',
    refundReturnPolicy: '',
    privacyPolicy: '',
    shippingPolicy: ''
  };
  const isStorePoliciesDirty = JSON.stringify(storePolicyFormValues) !== JSON.stringify(savedStorePolicyValues);

  const getUnsavedScopedSections = (): { id: ScopedSettingSection; label: string }[] => [
    ...(isIntroSplashDirty ? [{ id: 'introSplash' as const, label: 'Intro Splash' }] : []),
    ...(isCategorySectionsDirty ? [{ id: 'categorySections' as const, label: 'Category Sections' }] : []),
    ...(isLaunchRailDirty ? [{ id: 'launchRail' as const, label: 'New Launches & Offers Rail' }] : []),
    ...(isBadgePriorityDirty ? [{ id: 'productCards' as const, label: 'Product Card Badge Rules' }] : []),
    ...(isLowStockThresholdDirty ? [{ id: 'lowStock' as const, label: 'Low Stock Threshold' }] : []),
    ...(isTrustCardsDirty ? [{ id: 'trustCards' as const, label: 'Trust Cards' }] : []),
    ...(isTestimonialsDirty ? [{ id: 'testimonials' as const, label: 'Testimonials' }] : []),
    ...(isHeroSocialProofDirty ? [{ id: 'heroSocialProof' as const, label: 'Hero rating and review proof' }] : []),
    ...(isHeroOfferHighlightDirty ? [{ id: 'heroOfferHighlight' as const, label: 'Hero active offer highlight' }] : []),
    ...(isHeroPersonalGreetingDirty ? [{ id: 'heroPersonalGreeting' as const, label: 'Hero personalized greeting' }] : []),
    ...(isHeroInstagramStripDirty ? [{ id: 'heroInstagramStrip' as const, label: 'Hero Instagram strip' }] : []),
    ...(isHeroParallaxDirty ? [{ id: 'heroParallax' as const, label: 'Hero parallax' }] : []),
    ...(isDeliveryTimelineDirty ? [{ id: 'deliveryTimeline' as const, label: 'Delivery Timeline' }] : []),
    ...(isDeliveryPricingDirty ? [{ id: 'deliveryPricing' as const, label: 'Delivery Pricing' }] : []),
    ...(isUpiDetailsDirty ? [{ id: 'upi' as const, label: 'Direct UPI' }] : []),
    ...(isStorePoliciesDirty ? [{ id: 'policies' as const, label: 'Policies & Consent' }] : [])
  ];

  const confirmLeavingUnsavedScopedSections = () => {
    const unsavedSections = getUnsavedScopedSections();
    if (unsavedSections.length === 0) return true;
    const sectionNames = unsavedSections.map(item => item.label).join(' and ');
    return window.confirm(
      `You have unsaved changes in ${sectionNames}. Leave without saving those changes?`
    );
  };

  const navigateToSection = (section: typeof activeSection) => {
    if (section === activeSection) return;
    if (!confirmLeavingUnsavedScopedSections()) return;
    setActiveSection(section);
  };

  const saveScopedSection = async (section: ScopedSettingSection) => {
    if (section === 'heroDisplay' || scopedSaveStates[section].isSaving) return;
    const sectionLabel = section === 'introSplash'
      ? 'Intro Splash'
      : section === 'categorySections'
        ? 'Category Sections'
        : section === 'launchRail'
          ? 'New Launches & Offers Rail'
      : section === 'productCards'
      ? 'Product Card Badge Rules'
      : section === 'lowStock'
        ? 'Low Stock Threshold'
        : section === 'trustCards'
          ? 'Trust Cards'
          : section === 'testimonials'
            ? 'Testimonials'
            : section === 'deliveryTimeline'
              ? 'Delivery Timeline'
              : section === 'deliveryPricing'
                ? 'Delivery Pricing'
              : section === 'upi'
                ? 'Direct UPI'
                : section === 'policies'
                  ? 'Policies & Consent'
                  : section === 'heroSocialProof'
                    ? 'Hero rating and review proof'
                    : section === 'heroOfferHighlight'
                      ? 'Hero active offer highlight'
                      : section === 'heroPersonalGreeting'
                        ? 'Hero personalized greeting'
                        : section === 'heroInstagramStrip'
                          ? 'Hero Instagram strip'
                          : 'Hero parallax';
    const otherUnsavedSections = getUnsavedScopedSections().filter(item => item.id !== section);
    if (otherUnsavedSections.length > 0) {
      const otherSectionNames = otherUnsavedSections.map(item => item.label).join(' and ');
      const shouldContinue = window.confirm(
        `You have unsaved changes in ${otherSectionNames}. Save ${sectionLabel} without including those changes?`
      );
      if (!shouldContinue) return;
    }

    const nextPolicyVersion = section === 'policies'
      ? Math.max(0, Number(settings.storePolicyVersion) || 0) + 1
      : undefined;
    const payload: Partial<StoreSettings> = section === 'heroSocialProof'
      ? { showHeroSocialProof: form.showHeroSocialProof !== false }
      : section === 'heroOfferHighlight'
        ? { showHeroOfferHighlight: form.showHeroOfferHighlight !== false }
        : section === 'heroPersonalGreeting'
          ? { showHeroPersonalGreeting: form.showHeroPersonalGreeting !== false }
          : section === 'heroInstagramStrip'
            ? { showHeroInstagramStrip: form.showHeroInstagramStrip !== false }
            : section === 'heroParallax'
              ? { enableHeroParallax: form.enableHeroParallax !== false }
              : section === 'introSplash'
      ? {
        introSplashEnabled: form.introSplashEnabled !== false,
        introSplashDurationMs: Math.min(3000, Math.max(2000, Number(form.introSplashDurationMs) || 2500))
      }
      : section === 'categorySections'
        ? {
          categoryTopStockPreviewCount: Math.max(1, Math.min(12, Math.floor(Number(form.categoryTopStockPreviewCount) || 4))),
          categoryOtherPreviewCount: Math.max(1, Math.min(12, Math.floor(Number(form.categoryOtherPreviewCount) || 2))),
          categoryProductSortOrder: form.categoryProductSortOrder === 'newest-bestseller' ? 'newest-bestseller' : 'bestseller-newest'
        }
        : section === 'launchRail'
          ? {
            showLaunchRail: form.showLaunchRail !== false,
            launchRailProductsLimit: Math.max(1, Math.min(12, Math.floor(Number(form.launchRailProductsLimit) || 6))),
            launchRailProductSortOrder: form.launchRailProductSortOrder === 'bestselling' ? 'bestselling' : 'newest'
          }
      : section === 'productCards'
      ? { productCardBadgePriority: normalizedFormBadgePriority }
      : section === 'lowStock'
        ? { lowStockThreshold: Math.max(0, Math.floor(Number(form.lowStockThreshold) || 0)) }
        : section === 'trustCards'
          ? trustCardFormValues
          : section === 'testimonials'
            ? { showTestimonialsSection: form.showTestimonialsSection === true }
            : section === 'deliveryTimeline'
              ? deliveryTimelineFormValues
              : section === 'deliveryPricing'
                ? {
                  deliveryPricing: deliveryPricingPayload,
                  shippingFee: deliveryPricingPayload.fallback.charge
                }
              : section === 'upi'
                  ? {
                paymentUpiEnabled: form.paymentUpiEnabled !== false,
                upiId: String(form.upiId || '').trim(),
                upiPayeeName: String(form.upiPayeeName || '').trim() || 'Cozy Loops by Deepa',
                upiQrImage: form.upiQrImage || ''
                  }
                  : { storePolicies: storePolicyFormValues, storePolicyVersion: nextPolicyVersion };

    if (section === 'upi') {
      if (!isValidUpiVpa(String(form.upiId || ''))) {
        setScopedSaveStates(prev => ({
          ...prev,
          upi: { isSaving: false, error: 'Enter a valid UPI ID/VPA, such as name@bank.' }
        }));
        return;
      }
      if (!form.upiQrImage) {
        setScopedSaveStates(prev => ({
          ...prev,
          upi: { isSaving: false, error: 'Upload your UPI QR image before saving.' }
        }));
        return;
      }
    }
    if (section === 'policies' && Object.values(storePolicyFormValues).some(value => !value.trim())) {
      setScopedSaveStates(prev => ({
        ...prev,
        policies: { isSaving: false, error: 'Complete all four policy texts before saving.' }
      }));
      return;
    }
    if (section === 'deliveryPricing') {
      const error = deliveryPricingDraftHasInvalidRange
        ? 'Use comma-separated prefixes or ranges, such as 4000-4001, with same-length numeric endpoints.'
        : validateDeliveryPricing(deliveryPricingPayload);
      if (error) {
        setScopedSaveStates(prev => ({
          ...prev,
          deliveryPricing: { isSaving: false, error }
        }));
        return;
      }
    }

    setScopedSaveStates(prev => ({
      ...prev,
      [section]: { isSaving: true, error: '' }
    }));
    try {
      await updateSettings(payload);
      if (section === 'policies') {
        setForm(previous => ({ ...previous, storePolicyVersion: nextPolicyVersion }));
      }
      if (section === 'deliveryPricing') {
        setForm(previous => ({ ...previous, deliveryPricing: deliveryPricingPayload, shippingFee: deliveryPricingPayload.fallback.charge }));
        setDeliveryPrefixRangeDrafts(Object.fromEntries(
          deliveryPricingPayload.zones.map(zone => [zone.id, formatDeliveryPrefixRanges(zone.prefixRanges)])
        ));
      }
      setScopedSaveStates(prev => ({
        ...prev,
        [section]: { isSaving: false, error: '' }
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : `Could not save ${sectionLabel}.`;
      setScopedSaveStates(prev => ({
        ...prev,
        [section]: { isSaving: false, error: message }
      }));
    }
  };

  const handleUpiQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setUpiQrUploadError('Choose a PNG, JPG, GIF, or WebP image file.');
      return;
    }
    try {
      setUpiQrUploadError('');
      setIsUpiQrUploading(true);
      const url = await api.uploadImage(file);
      handleChange('upiQrImage', url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not upload the UPI QR image.';
      setUpiQrUploadError(message);
    } finally {
      setIsUpiQrUploading(false);
    }
  };

  const renderScopedSaveControls = (section: ScopedSettingSection, isDirty: boolean) => {
    const saveState = scopedSaveStates[section];
    const status = saveState.isSaving ? 'Saving…' : isDirty ? 'Unsaved changes' : 'Saved';
    const saveLabel = section === 'upi'
      ? 'Save Direct UPI'
      : section === 'policies'
        ? 'Save policies'
        : section === 'deliveryPricing'
          ? 'Save delivery pricing'
        : section === 'heroSocialProof'
          ? 'Save rating display'
          : section === 'heroOfferHighlight'
            ? 'Save offer display'
            : section === 'heroPersonalGreeting'
              ? 'Save greeting display'
              : section === 'heroInstagramStrip'
                ? 'Save Instagram display'
                : section === 'heroParallax'
                  ? 'Save parallax setting'
                  : 'Save section';
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
        marginTop: '20px',
        paddingTop: '16px',
        borderTop: '1px solid var(--border-light)'
      }}>
        <div>
          <p role="status" aria-live="polite" style={{
            fontSize: '0.82rem',
            fontWeight: 700,
            color: isDirty ? 'var(--accent-terracotta)' : 'var(--accent-sage)'
          }}>
            {status}
          </p>
          {saveState.error && (
            <p role="alert" style={{ marginTop: '4px', fontSize: '0.78rem', color: '#B91C1C' }}>
              {saveState.error}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void saveScopedSection(section)}
          disabled={!isDirty || saveState.isSaving}
          className="btn-primary"
          style={{
            padding: '10px 20px',
            fontSize: '0.86rem',
            opacity: !isDirty || saveState.isSaving ? 0.55 : 1,
            cursor: !isDirty || saveState.isSaving ? 'not-allowed' : 'pointer'
          }}
        >
          {saveState.isSaving ? <span>Saving…</span> : <><Save size={16} /><span>{saveLabel}</span></>}
        </button>
      </div>
    );
  };

  // Security Credentials state
  const [superAdminIdInput, setSuperAdminIdInput] = useState(() => settings.superAdminId || 'superadmin');
  const [newSuperAdminPassword, setNewSuperAdminPassword] = useState('');
  const [confirmSuperAdminPassword, setConfirmSuperAdminPassword] = useState('');
  const [showSuperAdminPw, setShowSuperAdminPw] = useState(false);

  const [newDeliveryPasscode, setNewDeliveryPasscode] = useState('');
  const [confirmDeliveryPasscode, setConfirmDeliveryPasscode] = useState('');
  const [showDeliveryPasscode, setShowDeliveryPasscode] = useState(false);

  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);

  const [clearRazorpaySecret, setClearRazorpaySecret] = useState(false);
  const [clearRazorpayWebhookSecret, setClearRazorpayWebhookSecret] = useState(false);
  const [clearPayuCredentials, setClearPayuCredentials] = useState(false);
  const [isTestingRazorpay, setIsTestingRazorpay] = useState(false);
  const [razorpayTestMessage, setRazorpayTestMessage] = useState('');

  const handleChange = <K extends keyof typeof form>(field: K, val: (typeof form)[K]) => {
    setForm(prev => ({ ...prev, [field]: val }));
    if (field in validationErrors) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const moveBadgePriority = (badge: ProductCardBadge, direction: -1 | 1) => {
    const priority = normalizeProductCardBadgePriority(form.productCardBadgePriority);
    const currentIndex = priority.indexOf(badge);
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= priority.length) return;
    [priority[currentIndex], priority[nextIndex]] = [priority[nextIndex], priority[currentIndex]];
    handleChange('productCardBadgePriority', priority);
  };

  const addCodRule = () => {
    const rule: CodRule = {
      id: crypto.randomUUID(),
      availability: 'disabled'
    };
    setForm(prev => ({ ...prev, codRules: [...(prev.codRules || []), rule] }));
  };

  const updateCodRule = (id: string, changes: Partial<CodRule>) => {
    setForm(prev => ({
      ...prev,
      codRules: (prev.codRules || []).map(rule => rule.id === id ? { ...rule, ...changes } : rule)
    }));
    setCodRuleErrors(prev => ({ ...prev, [id]: '' }));
  };

  const removeCodRule = (id: string) => {
    setForm(prev => ({ ...prev, codRules: (prev.codRules || []).filter(rule => rule.id !== id) }));
    setCodRuleErrors(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsHeroUploading(true);
      const url = await api.uploadImage(file);
      handleChange('heroImage', url);
    } catch {
      alert('Failed to upload hero image');
    } finally {
      setIsHeroUploading(false);
    }
  };

  const handleAboutUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsAboutUploading(true);
      const url = await api.uploadImage(file);
      handleChange('aboutImage', url);
    } catch {
      alert('Failed to upload artisan story photo');
    } finally {
      setIsAboutUploading(false);
    }
  };

  const handleSave = async (e?: React.FormEvent): Promise<boolean> => {
    if (e) e.preventDefault();

    const unsavedScopedSections = getUnsavedScopedSections();
    if (unsavedScopedSections.length > 0) {
      const sectionNames = unsavedScopedSections.map(item => item.label).join(' and ');
      const shouldContinue = window.confirm(
        `You have unsaved changes in ${sectionNames}. The current section save will not include them. Continue?`
      );
      if (!shouldContinue) return false;
    }
    
    const payload: Partial<typeof form> & { clearPayuCredentials?: boolean } = { ...form };
    payload.currency = '₹';
    delete payload.productCardBadgePriority;
    delete payload.lowStockThreshold;
    delete payload.trustBadge1Icon;
    delete payload.trustBadge1Title;
    delete payload.trustBadge1Desc;
    delete payload.trustBadge2Icon;
    delete payload.trustBadge2Title;
    delete payload.trustBadge2Desc;
    delete payload.trustBadge3Icon;
    delete payload.trustBadge3Title;
    delete payload.trustBadge3Desc;
    delete payload.trustBadge4Icon;
    delete payload.trustBadge4Title;
    delete payload.trustBadge4Desc;
    delete payload.showTestimonialsSection;
    delete payload.deliveryStagePlacedLabel;
    delete payload.deliveryStageConfirmedLabel;
    delete payload.deliveryStageInPreparationLabel;
    delete payload.deliveryStageShippedLabel;
    delete payload.deliveryStageOutForDeliveryLabel;
    delete payload.deliveryStageDeliveredLabel;
    delete payload.deliveryPricing;
    delete payload.paymentUpiEnabled;
    delete payload.upiId;
    delete payload.upiQrImage;
    delete payload.storePolicies;
    delete payload.storePolicyVersion;
    const requiredFieldErrors: typeof validationErrors = {};
    if (!String(form.storeName || '').trim()) requiredFieldErrors.storeName = 'Enter the store or studio name.';
    if (!String(form.heroTitle || '').trim()) requiredFieldErrors.heroTitle = 'Enter the hero headline.';
    setValidationErrors(prev => ({ ...prev, ...requiredFieldErrors }));
    if (Object.values(requiredFieldErrors).some(Boolean)) return false;

    delete payload.adminPasscode;
    delete payload.superAdminPassword;
    delete payload.deliveryAgentPasscode;
    delete payload.razorpayKeySecret;
    delete payload.razorpayWebhookSecret;
    delete payload.payuMerchantKey;
    delete payload.payuMerchantSalt;
    delete payload.payuConfigured;
    delete payload.clearPayuCredentials;
    const nextCodRuleErrors: Record<string, string> = {};
    for (const rule of payload.codRules || []) {
      const hasPriceCondition = rule.minPrice !== undefined || rule.maxPrice !== undefined;
      if (!rule.category && !hasPriceCondition) {
        nextCodRuleErrors[rule.id] = 'Choose a category or enter a minimum/maximum price for this rule.';
      } else if (
        (rule.minPrice !== undefined && (!Number.isFinite(rule.minPrice) || rule.minPrice < 0)) ||
        (rule.maxPrice !== undefined && (!Number.isFinite(rule.maxPrice) || rule.maxPrice < 0)) ||
        (rule.minPrice !== undefined && rule.maxPrice !== undefined && rule.minPrice > rule.maxPrice)
      ) {
        nextCodRuleErrors[rule.id] = rule.minPrice !== undefined && rule.maxPrice !== undefined && rule.minPrice > rule.maxPrice
          ? 'Minimum price cannot be greater than maximum price.'
          : 'Enter valid minimum and maximum prices of 0 or more.';
      }
    }
    setCodRuleErrors(nextCodRuleErrors);
    if (Object.keys(nextCodRuleErrors).length > 0) return false;
    delete payload.upiPayeeName;
    if (payload.whatsappEnabled !== false) {
      const whatsappPhone = String(payload.whatsappBusinessPhone || payload.contactPhone || '');
      const phoneDigits = whatsappPhone.replace(/\D/g, '');
      const countryCode = String(payload.whatsappCountryCode || '91').replace(/\D/g, '');
      if (phoneDigits.length < 7 || phoneDigits.length > 15) {
        alert('Enter a valid WhatsApp business number, or add one under Contact & Socials.');
        return false;
      }
      if (countryCode.length < 1 || countryCode.length > 4) {
        alert('Enter a valid default country calling code using 1 to 4 digits.');
        return false;
      }
      payload.whatsappCountryCode = countryCode;
    }
    if (clearRazorpaySecret) payload.razorpayKeySecret = '';
    else if (form.razorpayKeySecret?.trim()) payload.razorpayKeySecret = form.razorpayKeySecret.trim();
    if (clearRazorpayWebhookSecret) payload.razorpayWebhookSecret = '';
    else if (form.razorpayWebhookSecret?.trim()) payload.razorpayWebhookSecret = form.razorpayWebhookSecret.trim();
    if (clearPayuCredentials) {
      payload.clearPayuCredentials = true;
      payload.paymentPayuEnabled = false;
    } else {
      if (form.payuMerchantKey?.trim()) payload.payuMerchantKey = form.payuMerchantKey.trim();
      if (form.payuMerchantSalt?.trim()) payload.payuMerchantSalt = form.payuMerchantSalt.trim();
    }
    if (
      payload.paymentPayuEnabled &&
      !form.payuConfigured &&
      (!form.payuMerchantKey?.trim() || !form.payuMerchantSalt?.trim())
    ) {
      alert('Enter both the PayU Merchant Key and Salt before enabling PayU.');
      return false;
    }

    // 1. Super Admin ID change
    if (superAdminIdInput.trim() && superAdminIdInput.trim() !== (settings.superAdminId || 'superadmin')) {
      if (superAdminIdInput.trim().length < 3) {
        alert('Super Admin ID must be at least 3 characters.');
        return false;
      }
      payload.superAdminId = superAdminIdInput.trim();
    }

    // 2. Super Admin Password change
    if (newSuperAdminPassword.trim()) {
      if (newSuperAdminPassword !== confirmSuperAdminPassword) {
        alert('Super Admin passwords do not match! Please verify.');
        return false;
      }
      if (newSuperAdminPassword.trim().length < minimumServerPasscodeLength) {
        alert(`Super Admin password must be at least ${minimumServerPasscodeLength} characters.`);
        return false;
      }
      payload.superAdminPassword = newSuperAdminPassword.trim();
    }

    // 3. Delivery Agent Passcode change
    if (newDeliveryPasscode.trim()) {
      if (newDeliveryPasscode !== confirmDeliveryPasscode) {
        alert('Delivery Agent passcodes do not match! Please verify.');
        return false;
      }
      if (newDeliveryPasscode.trim().length < minimumServerPasscodeLength) {
        alert(`Delivery Agent passcode must be at least ${minimumServerPasscodeLength} characters.`);
        return false;
      }
      payload.deliveryAgentPasscode = newDeliveryPasscode.trim();
    }

    // 4. Studio Admin Passcode change (optional)
    if (newPasscode.trim()) {
      if (newPasscode !== confirmPasscode) {
        alert('Studio Staff Passcodes do not match! Please verify.');
        return false;
      }
      if (newPasscode.trim().length < minimumServerPasscodeLength) {
        alert(`Studio Staff Passcode must be at least ${minimumServerPasscodeLength} characters.`);
        return false;
      }
      payload.adminPasscode = newPasscode.trim();
    }

    try {
      await updateSettings(payload);
      setForm(prev => ({
        ...prev,
        razorpayKeySecret: '',
        razorpayKeySecretConfigured: clearRazorpaySecret ? false : Boolean(prev.razorpayKeySecretConfigured || form.razorpayKeySecret?.trim()),
        razorpayWebhookSecret: '',
        razorpayWebhookSecretConfigured: clearRazorpayWebhookSecret ? false : Boolean(prev.razorpayWebhookSecretConfigured || form.razorpayWebhookSecret?.trim()),
        payuMerchantKey: '',
        payuMerchantSalt: '',
        payuConfigured: clearPayuCredentials ? false : Boolean(prev.payuConfigured || form.payuMerchantKey?.trim() || form.payuMerchantSalt?.trim())
      }));
      setClearRazorpaySecret(false);
      setClearRazorpayWebhookSecret(false);
      setClearPayuCredentials(false);
      setSavedSuccess(true);
      setNewSuperAdminPassword('');
      setConfirmSuperAdminPassword('');
      setNewDeliveryPasscode('');
      setConfirmDeliveryPasscode('');
      setNewPasscode('');
      setConfirmPasscode('');
      setTimeout(() => setSavedSuccess(false), 2500);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save settings. Check the required details and try again.';
      alert(message);
      return false;
    }
  };

  const navItems = [
    { id: 'theme' as const, label: 'Theme & Colors', icon: <Palette size={16} /> },
    { id: 'header' as const, label: 'Brand & Announcement', icon: <Sparkles size={16} /> },
    { id: 'hero' as const, label: 'Hero Banner', icon: <ImageIcon size={16} /> },
    { id: 'heroDisplay' as const, label: 'Hero Display Options', icon: <Sliders size={16} /> },
    { id: 'introSplash' as const, label: 'Intro Splash', icon: <Eye size={16} /> },
    { id: 'categorySections' as const, label: 'Category Sections', icon: <Sliders size={16} /> },
    { id: 'launchRail' as const, label: 'Launches & Offers Rail', icon: <Sparkles size={16} /> },
    { id: 'story' as const, label: 'Artisan Story', icon: <Heart size={16} /> },
    { id: 'trustCards' as const, label: 'Trust Cards', icon: <ShieldCheck size={16} /> },
    { id: 'testimonials' as const, label: 'Testimonials', icon: <Sparkles size={16} /> },
    { id: 'deliveryTimeline' as const, label: 'Delivery Timeline', icon: <Truck size={16} /> },
    { id: 'shipping' as const, label: 'Shipping & Inventory', icon: <Truck size={16} /> },
    { id: 'deliveryPricing' as const, label: 'Delivery Pricing by Pincode', icon: <Truck size={16} /> },
    { id: 'productCards' as const, label: 'Product Cards', icon: <Sliders size={16} /> },
    { id: 'lowStock' as const, label: 'Low Stock Threshold', icon: <Info size={16} /> },
    { id: 'cod' as const, label: 'COD Eligibility Rules', icon: <Truck size={16} /> },
    { id: 'whatsapp' as const, label: 'WhatsApp Messages', icon: <MessageCircle size={16} /> },
    { id: 'payments' as const, label: 'Payment Gateways', icon: <CreditCard size={16} /> },
    { id: 'upi' as const, label: 'Direct UPI', icon: <QrCode size={16} /> },
    { id: 'policies' as const, label: 'Policies & Consent', icon: <FileText size={16} /> },
    { id: 'contact' as const, label: 'Contact & Socials', icon: <MessageCircle size={16} /> },
    { id: 'footer' as const, label: 'Footer & Copyright', icon: <Sliders size={16} /> },
    { id: 'security' as const, label: 'Security & Access Passcodes', icon: <Lock size={16} /> },
    { id: 'db' as const, label: 'Database & Backup', icon: <Database size={16} /> }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner / Save Action Header */}
      <div style={{
        backgroundColor: '#FFFFFF',
        padding: '20px 26px',
        borderRadius: '20px',
        border: '1px solid var(--border-medium)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        position: 'sticky',
        top: '80px',
        zIndex: 20
      }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.78rem',
            fontWeight: 700,
            color: 'var(--accent-terracotta)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            <Sliders size={14} />
            <span>Super Admin Full Control</span>
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
            Studio & Store Controls
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Complete "head-to-toe" control over branding, hero banner, artisan story, trust perks, colors, and logistics.
          </p>
        </div>

        <div className="dashboard-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => {
              if (confirmLeavingUnsavedScopedSections()) setViewMode('store');
            }}
            className="btn-secondary"
            style={{ padding: '9px 16px', fontSize: '0.84rem' }}
          >
            <Eye size={15} />
            <span>Live Store Preview</span>
          </button>

          {!isScopedSettingSection(activeSection) && (
            <button
              type="button"
              onClick={() => handleSave()}
              className="btn-primary"
              style={{ padding: '10px 22px', fontSize: '0.88rem' }}
            >
              {savedSuccess ? <Check size={16} /> : <Save size={16} />}
              <span>{savedSuccess ? 'Changes Saved!' : 'Save All Changes'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Two-Column Layout: Sidebar Nav + Form Section */}
      <div className="studio-settings-layout" style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(240px, 280px) 1fr',
        gap: '24px',
        alignItems: 'start'
      }}>
        {/* Navigation Sidebar */}
        <div className="studio-settings-nav" style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '16px',
          border: '1px solid var(--border-medium)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          position: 'sticky',
          top: '190px'
        }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-subtle)', padding: '6px 12px', textTransform: 'uppercase' }}>
            Sections to Customize
          </div>
          {navItems.map(item => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateToSection(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  fontSize: '0.86rem',
                  fontWeight: isActive ? 700 : 500,
                  backgroundColor: isActive ? 'var(--accent-terracotta-light)' : 'transparent',
                  color: isActive ? 'var(--accent-terracotta)' : 'var(--text-main)',
                  border: isActive ? '1px solid var(--border-dashed)' : '1px solid transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Section Editor */}
        <form
          onSubmit={(e) => {
            if (activeSection === 'heroDisplay') {
              e.preventDefault();
              return;
            }
            if (isScopedSettingSection(activeSection)) {
              e.preventDefault();
              void saveScopedSection(activeSection);
              return;
            }
            void handleSave(e);
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
        >

          {activeSection === 'introSplash' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Eye size={20} color="var(--accent-terracotta)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Intro Splash Screen
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '22px', lineHeight: 1.5 }}>
                Show your brand introduction once per visitor session. The storefront data loads behind it before the timed fade begins.
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={form.introSplashEnabled !== false}
                  onChange={event => handleChange('introSplashEnabled', event.target.checked)}
                />
                Enable the intro splash
              </label>
              <label htmlFor="intro-splash-duration" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginTop: '20px', marginBottom: '8px' }}>
                Display duration
              </label>
              <select
                id="intro-splash-duration"
                value={form.introSplashDurationMs ?? 2500}
                onChange={event => handleChange('introSplashDurationMs', Number(event.target.value))}
                disabled={form.introSplashEnabled === false}
                style={{ width: '100%', maxWidth: '320px', minHeight: '44px', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-medium)', backgroundColor: '#FFFFFF', fontSize: '0.9rem' }}
              >
                <option value={2000}>2 seconds</option>
                <option value={2500}>2.5 seconds</option>
                <option value={3000}>3 seconds</option>
              </select>
              {renderScopedSaveControls('introSplash', isIntroSplashDirty)}
            </div>
          )}

          {activeSection === 'categorySections' && (
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '28px', border: '1px solid var(--border-medium)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Sliders size={20} color="var(--accent-terracotta)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Storefront Category Sections</h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '22px', lineHeight: 1.5 }}>
                Set how many products each category previews and which products lead. A category with one product always shows one; empty categories stay hidden. These values apply to the storefront and Studio product grid.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px' }}>
                <label style={{ display: 'grid', gap: '7px', fontSize: '0.82rem', fontWeight: 700 }}>
                  Most-stocked category preview
                  <input
                    type="number"
                    min="1"
                    max="12"
                    step="1"
                    value={form.categoryTopStockPreviewCount ?? 4}
                    onChange={event => handleChange('categoryTopStockPreviewCount', Math.max(1, Math.min(12, Number(event.target.value) || 1)))}
                    style={{ minHeight: '44px', padding: '10px 14px', border: '1px solid var(--border-medium)', borderRadius: '10px' }}
                  />
                </label>
                <label style={{ display: 'grid', gap: '7px', fontSize: '0.82rem', fontWeight: 700 }}>
                  Other multi-product categories
                  <input
                    type="number"
                    min="1"
                    max="12"
                    step="1"
                    value={form.categoryOtherPreviewCount ?? 2}
                    onChange={event => handleChange('categoryOtherPreviewCount', Math.max(1, Math.min(12, Number(event.target.value) || 1)))}
                    style={{ minHeight: '44px', padding: '10px 14px', border: '1px solid var(--border-medium)', borderRadius: '10px' }}
                  />
                </label>
                <label style={{ display: 'grid', gap: '7px', fontSize: '0.82rem', fontWeight: 700 }}>
                  Product order
                  <select
                    value={form.categoryProductSortOrder || 'bestseller-newest'}
                    onChange={event => handleChange('categoryProductSortOrder', event.target.value as 'bestseller-newest' | 'newest-bestseller')}
                    style={{ minHeight: '44px', padding: '10px 14px', border: '1px solid var(--border-medium)', borderRadius: '10px', background: '#FFFFFF' }}
                  >
                    <option value="bestseller-newest">Bestsellers, then newest</option>
                    <option value="newest-bestseller">Newest, then bestsellers</option>
                  </select>
                </label>
              </div>
              {renderScopedSaveControls('categorySections', isCategorySectionsDirty)}
            </div>
          )}

          {activeSection === 'launchRail' && (
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '28px', border: '1px solid var(--border-medium)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Sparkles size={20} color="var(--accent-terracotta)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>New Launches &amp; Offers Rail</h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '22px', lineHeight: 1.5 }}>
                Launch items come from products marked Featured in Products &amp; Images; active offers continue to come from Offers &amp; Campaigns.
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', fontSize: '0.9rem', fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={form.showLaunchRail !== false}
                  onChange={event => handleChange('showLaunchRail', event.target.checked)}
                />
                Show the launch and offers rail
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px' }}>
                <label style={{ display: 'grid', gap: '7px', fontSize: '0.82rem', fontWeight: 700 }}>
                  Maximum featured products
                  <input
                    type="number"
                    min="1"
                    max="12"
                    step="1"
                    value={form.launchRailProductsLimit ?? 6}
                    disabled={form.showLaunchRail === false}
                    onChange={event => handleChange('launchRailProductsLimit', Math.max(1, Math.min(12, Number(event.target.value) || 1)))}
                    style={{ minHeight: '44px', padding: '10px 14px', border: '1px solid var(--border-medium)', borderRadius: '10px' }}
                  />
                </label>
                <label style={{ display: 'grid', gap: '7px', fontSize: '0.82rem', fontWeight: 700 }}>
                  Featured product order
                  <select
                    value={form.launchRailProductSortOrder || 'newest'}
                    disabled={form.showLaunchRail === false}
                    onChange={event => handleChange('launchRailProductSortOrder', event.target.value as 'newest' | 'bestselling')}
                    style={{ minHeight: '44px', padding: '10px 14px', border: '1px solid var(--border-medium)', borderRadius: '10px', background: '#FFFFFF' }}
                  >
                    <option value="newest">Newest first</option>
                    <option value="bestselling">Bestsellers first</option>
                  </select>
                </label>
              </div>
              {renderScopedSaveControls('launchRail', isLaunchRailDirty)}
            </div>
          )}
          
          {/* 1. THEME & COLORS */}
          {activeSection === 'theme' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Palette size={20} color="var(--accent-terracotta)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Theme Color Palette
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '22px' }}>
                Pick an artisan brand color preset or choose any custom hex code. All buttons, badges, discount highlights, and borders will update immediately across the entire site.
              </p>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '10px' }}>
                  Curated Crochet Color Presets
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                  {COLOR_PRESETS.map(preset => {
                    const isSelected = form.themeColor?.toLowerCase() === preset.hex.toLowerCase();
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => handleChange('themeColor', preset.hex)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px 14px',
                          borderRadius: '12px',
                          border: isSelected ? '2px solid var(--text-main)' : '1px solid var(--border-medium)',
                          backgroundColor: isSelected ? 'var(--bg-surface-soft)' : '#FFFFFF',
                          cursor: 'pointer',
                          boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                          textAlign: 'left'
                        }}
                      >
                        <span style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: preset.preview,
                          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                          display: 'inline-block',
                          flexShrink: 0
                        }} />
                        <div>
                          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>
                            {preset.name}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {preset.hex}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '8px' }}>
                  Or Select Custom Hex Color
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="color"
                    value={form.themeColor || '#C85A32'}
                    onChange={(e) => handleChange('themeColor', e.target.value)}
                    style={{
                      width: '46px',
                      height: '42px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-medium)',
                      cursor: 'pointer',
                      padding: '2px'
                    }}
                  />
                  <input
                    type="text"
                    value={form.themeColor || '#C85A32'}
                    onChange={(e) => handleChange('themeColor', e.target.value)}
                    placeholder="#C85A32"
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-medium)',
                      fontSize: '0.9rem',
                      fontFamily: 'monospace',
                      width: '160px'
                    }}
                  />
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Active accent color applied across website
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 2. BRAND & ANNOUNCEMENT */}
          {activeSection === 'header' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Sparkles size={20} color="var(--accent-terracotta)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Brand Identity & Announcement Bar
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '22px' }}>
                Configure store title, craft tagline, and top ribbon banner notices.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    Store / Studio Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.storeName}
                    onChange={(e) => handleChange('storeName', e.target.value)}
                    aria-invalid={Boolean(validationErrors.storeName)}
                    placeholder="e.g. Cozy Loops by Deepa"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: `1px solid ${validationErrors.storeName ? '#DC2626' : 'var(--border-medium)'}`,
                      fontSize: '0.9rem'
                    }}
                  />
                  {validationErrors.storeName && <p role="alert" style={{ color: '#DC2626', fontSize: '0.76rem', margin: '4px 0 0' }}>{validationErrors.storeName}</p>}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    Store Tagline
                  </label>
                  <input
                    type="text"
                    value={form.storeTagline}
                    onChange={(e) => handleChange('storeTagline', e.target.value)}
                    placeholder="e.g. Cozy, Handmade Happiness • Premium Crochet Hair Accessories"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-medium)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1', padding: '16px', borderRadius: '14px', backgroundColor: 'var(--bg-surface-soft)', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 700 }}>
                        Top Ribbon Announcement Bar
                      </h4>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Displays at the very top of every page for shipping notices and special offers.
                      </p>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={form.showAnnouncement !== false}
                        onChange={(e) => handleChange('showAnnouncement', e.target.checked)}
                      />
                      <span>Show Announcement Bar</span>
                    </label>
                  </div>

                  {form.showAnnouncement !== false && (
                    <div>
                      <input
                        type="text"
                        value={form.announcementText}
                        onChange={(e) => handleChange('announcementText', e.target.value)}
                        placeholder="e.g. 100% Handmade with Love 🌸 Free Shipping on orders above ₹299"
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-medium)',
                          fontSize: '0.88rem',
                          backgroundColor: '#FFFFFF'
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. HERO BANNER */}
          {activeSection === 'hero' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <ImageIcon size={20} color="var(--accent-terracotta)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Hero Showcase Banner (First Impression)
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '22px' }}>
                Customize the headline, descriptive blurb, badge pill, CTA buttons, and high-resolution hero photo.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                      Hero Badge Pill
                    </label>
                    <input
                      type="text"
                      value={form.heroBadge || ''}
                      onChange={(e) => handleChange('heroBadge', e.target.value)}
                      placeholder="e.g. 🌸 100% Handcrafted with Love"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-medium)',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                      Hero Main Headline *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.heroTitle}
                      onChange={(e) => handleChange('heroTitle', e.target.value)}
                      aria-invalid={Boolean(validationErrors.heroTitle)}
                      placeholder="e.g. Cozy Loops by Deepa"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: `1px solid ${validationErrors.heroTitle ? '#DC2626' : 'var(--border-medium)'}`,
                        fontSize: '0.9rem'
                      }}
                    />
                    {validationErrors.heroTitle && <p role="alert" style={{ color: '#DC2626', fontSize: '0.76rem', margin: '4px 0 0' }}>{validationErrors.heroTitle}</p>}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    Hero Craft Description & Subtitle
                  </label>
                  <textarea
                    rows={2}
                    value={form.heroSubtitle}
                    onChange={(e) => handleChange('heroSubtitle', e.target.value)}
                    placeholder="e.g. 100% handmade with love. Big flower rose ponytail holders, sunny clips, and handcrafted floral accessories."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-medium)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                      Primary Button Label
                    </label>
                    <input
                      type="text"
                      value={form.heroPrimaryBtnText || ''}
                      onChange={(e) => handleChange('heroPrimaryBtnText', e.target.value)}
                      placeholder="e.g. Shop Handcrafted Collection"
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
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                      Secondary Button Label
                    </label>
                    <input
                      type="text"
                      value={form.heroSecondaryBtnText || ''}
                      onChange={(e) => handleChange('heroSecondaryBtnText', e.target.value)}
                      placeholder="e.g. View Special Combos"
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

                {/* Hero Photo Upload & Preview */}
                <div style={{
                  padding: '18px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--bg-surface-soft)',
                  border: '1px solid var(--border-light)'
                }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '8px' }}>
                    Hero Showcase Image (Upload file or paste URL)
                  </label>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="file"
                      ref={heroFileInputRef}
                      accept="image/*"
                      onChange={handleHeroUpload}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => heroFileInputRef.current?.click()}
                      disabled={isHeroUploading}
                      className="btn-primary"
                      style={{ padding: '8px 16px', fontSize: '0.82rem' }}
                    >
                      <Upload size={14} />
                      <span>{isHeroUploading ? 'Uploading...' : 'Upload Image from Device'}</span>
                    </button>

                    <input
                      type="text"
                      value={form.heroImage || ''}
                      onChange={(e) => handleChange('heroImage', e.target.value)}
                      placeholder="Or enter image URL e.g. /uploads/image.jpg..."
                      style={{
                        flex: 1,
                        minWidth: '220px',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-medium)',
                        fontSize: '0.84rem',
                        backgroundColor: '#FFFFFF'
                      }}
                    />

                    {form.heroImage && (
                      <div style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '1px solid var(--border-medium)',
                        flexShrink: 0
                      }}>
                        <img
                          src={getAssetUrl(form.heroImage)}
                          alt="Hero Thumbnail Preview"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'heroDisplay' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Sliders size={20} color="var(--accent-terracotta)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Hero Display Options
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '22px' }}>
                Each option saves independently. Ratings and offers always come from existing store data; these controls only change whether each feature is displayed.
              </p>

              <div style={{ display: 'grid', gap: '14px' }}>
                {[
                  {
                    section: 'heroSocialProof' as const,
                    setting: 'showHeroSocialProof' as const,
                    dirty: isHeroSocialProofDirty,
                    title: 'Real rating and review count',
                    description: 'Show the aggregate rating only when products have real ratings and review counts.'
                  },
                  {
                    section: 'heroOfferHighlight' as const,
                    setting: 'showHeroOfferHighlight' as const,
                    dirty: isHeroOfferHighlightDirty,
                    title: 'Active offer highlight and countdown',
                    description: 'Show currently active offers. A countdown appears only when an offer has a valid future end date.'
                  },
                  {
                    section: 'heroPersonalGreeting' as const,
                    setting: 'showHeroPersonalGreeting' as const,
                    dirty: isHeroPersonalGreetingDirty,
                    title: 'Signed-in customer greeting',
                    description: 'Replace the generic tagline with the customer’s name after their session is confirmed.'
                  },
                  {
                    section: 'heroInstagramStrip' as const,
                    setting: 'showHeroInstagramStrip' as const,
                    dirty: isHeroInstagramStripDirty,
                    title: 'Instagram follow strip',
                    description: 'Show a lightweight static link to the Instagram handle configured in Contact & Socials.'
                  },
                  {
                    section: 'heroParallax' as const,
                    setting: 'enableHeroParallax' as const,
                    dirty: isHeroParallaxDirty,
                    title: 'Desktop hero-image parallax',
                    description: 'Use transform-only movement; it remains disabled on mobile, low-core devices, and when reduced motion is preferred.'
                  }
                ].map(option => (
                  <section
                    key={option.section}
                    style={{
                      padding: '18px',
                      border: '1px solid var(--border-light)',
                      borderRadius: '14px',
                      background: 'var(--bg-surface-soft)'
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form[option.setting] !== false}
                        onChange={event => handleChange(option.setting, event.target.checked)}
                        style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: 'var(--accent-terracotta)' }}
                      />
                      <span>
                        <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                          {option.title}
                        </strong>
                        <span style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.5 }}>
                          {option.description}
                        </span>
                      </span>
                    </label>
                    {renderScopedSaveControls(option.section, option.dirty)}
                  </section>
                ))}
              </div>
            </div>
          )}

          {/* 4. ARTISAN STORY / ABOUT SECTION */}
          {activeSection === 'story' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Heart size={20} color="var(--accent-terracotta)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Artisan Story & Maker Ethos Section
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '22px' }}>
                Share your personal journey as a crochet artist. Tells visitors why handmade slow fashion is special.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '12px', backgroundColor: 'var(--bg-surface-soft)' }}>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Show Story Section on Landing Page</h4>
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Displays full biography, quotes, and studio photography.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.showAboutSection !== false}
                    onChange={(e) => handleChange('showAboutSection', e.target.checked)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                      Story Badge Pill
                    </label>
                    <input
                      type="text"
                      value={form.aboutBadge || ''}
                      onChange={(e) => handleChange('aboutBadge', e.target.value)}
                      placeholder="e.g. Our Story & Maker Ethos"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-medium)',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                      Story Title
                    </label>
                    <input
                      type="text"
                      value={form.aboutTitle || ''}
                      onChange={(e) => handleChange('aboutTitle', e.target.value)}
                      placeholder="e.g. Meet Deepa • The Hands Behind Every Petal & Loop"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-medium)',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    Story Narrative Paragraph 1
                  </label>
                  <textarea
                    rows={3}
                    value={form.aboutStory1 || ''}
                    onChange={(e) => handleChange('aboutStory1', e.target.value)}
                    placeholder="e.g. Unlike industrial knitwear which can be copied by commercial machinery, true crochet cannot be replicated by any machine in existence..."
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
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    Story Narrative Paragraph 2
                  </label>
                  <textarea
                    rows={2}
                    value={form.aboutStory2 || ''}
                    onChange={(e) => handleChange('aboutStory2', e.target.value)}
                    placeholder="e.g. We use ultra-soft milk cotton and durable elastic bands to craft accessories that don't pull hair, hold securely, and bring a bloom of happiness..."
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
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    Artisan Philosophy Quote
                  </label>
                  <input
                    type="text"
                    value={form.aboutQuote || ''}
                    onChange={(e) => handleChange('aboutQuote', e.target.value)}
                    placeholder="e.g. Every stitch is a gentle pause of mindfulness, turning simple yarn into wearable floral art."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-medium)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                {/* About Image Upload */}
                <div style={{
                  padding: '18px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--bg-surface-soft)',
                  border: '1px solid var(--border-light)'
                }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '8px' }}>
                    Artisan Studio Photo (Upload photo or paste URL)
                  </label>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="file"
                      ref={aboutFileInputRef}
                      accept="image/*"
                      onChange={handleAboutUpload}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => aboutFileInputRef.current?.click()}
                      disabled={isAboutUploading}
                      className="btn-primary"
                      style={{ padding: '8px 16px', fontSize: '0.82rem' }}
                    >
                      <Upload size={14} />
                      <span>{isAboutUploading ? 'Uploading...' : 'Upload Photo'}</span>
                    </button>

                    <input
                      type="text"
                      value={form.aboutImage || ''}
                      onChange={(e) => handleChange('aboutImage', e.target.value)}
                      placeholder="e.g. /uploads/artisan_deepa.jpg"
                      style={{
                        flex: 1,
                        minWidth: '220px',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-medium)',
                        fontSize: '0.84rem',
                        backgroundColor: '#FFFFFF'
                      }}
                    />

                    {form.aboutImage && (
                      <div style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '1px solid var(--border-medium)',
                        flexShrink: 0
                      }}>
                        <img
                          src={getAssetUrl(form.aboutImage)}
                          alt="About Preview"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TRUST CARDS */}
          {activeSection === 'trustCards' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <ShieldCheck size={20} color="var(--accent-terracotta)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  4 Trust Badges & Value Perks
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '22px' }}>
                Customize the 4 highlight pillars displayed beneath the hero and story sections.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
                {/* Perk 1 */}
                <div style={{ padding: '16px', borderRadius: '14px', backgroundColor: 'var(--bg-surface-soft)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-terracotta)', marginBottom: '8px' }}>
                    PILLAR 1
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      placeholder="Emoji"
                      value={form.trustBadge1Icon || '🌸'}
                      onChange={(e) => handleChange('trustBadge1Icon', e.target.value)}
                      style={{ width: '50px', padding: '8px', textAlign: 'center', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: '#FFFFFF' }}
                    />
                    <input
                      type="text"
                      placeholder="Title"
                      value={form.trustBadge1Title || ''}
                      onChange={(e) => handleChange('trustBadge1Title', e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: '#FFFFFF', fontWeight: 600, fontSize: '0.84rem' }}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Short description"
                    value={form.trustBadge1Desc || ''}
                    onChange={(e) => handleChange('trustBadge1Desc', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: '#FFFFFF', fontSize: '0.8rem' }}
                  />
                </div>

                {/* Perk 2 */}
                <div style={{ padding: '16px', borderRadius: '14px', backgroundColor: 'var(--bg-surface-soft)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-terracotta)', marginBottom: '8px' }}>
                    PILLAR 2
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      placeholder="Emoji"
                      value={form.trustBadge2Icon || '🧶'}
                      onChange={(e) => handleChange('trustBadge2Icon', e.target.value)}
                      style={{ width: '50px', padding: '8px', textAlign: 'center', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: '#FFFFFF' }}
                    />
                    <input
                      type="text"
                      placeholder="Title"
                      value={form.trustBadge2Title || ''}
                      onChange={(e) => handleChange('trustBadge2Title', e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: '#FFFFFF', fontWeight: 600, fontSize: '0.84rem' }}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Short description"
                    value={form.trustBadge2Desc || ''}
                    onChange={(e) => handleChange('trustBadge2Desc', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: '#FFFFFF', fontSize: '0.8rem' }}
                  />
                </div>

                {/* Perk 3 */}
                <div style={{ padding: '16px', borderRadius: '14px', backgroundColor: 'var(--bg-surface-soft)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-terracotta)', marginBottom: '8px' }}>
                    PILLAR 3
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      placeholder="Emoji"
                      value={form.trustBadge3Icon || '✨'}
                      onChange={(e) => handleChange('trustBadge3Icon', e.target.value)}
                      style={{ width: '50px', padding: '8px', textAlign: 'center', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: '#FFFFFF' }}
                    />
                    <input
                      type="text"
                      placeholder="Title"
                      value={form.trustBadge3Title || ''}
                      onChange={(e) => handleChange('trustBadge3Title', e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: '#FFFFFF', fontWeight: 600, fontSize: '0.84rem' }}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Short description"
                    value={form.trustBadge3Desc || ''}
                    onChange={(e) => handleChange('trustBadge3Desc', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: '#FFFFFF', fontSize: '0.8rem' }}
                  />
                </div>

                {/* Perk 4 */}
                <div style={{ padding: '16px', borderRadius: '14px', backgroundColor: 'var(--bg-surface-soft)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-terracotta)', marginBottom: '8px' }}>
                    PILLAR 4
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      placeholder="Emoji"
                      value={form.trustBadge4Icon || '📦'}
                      onChange={(e) => handleChange('trustBadge4Icon', e.target.value)}
                      style={{ width: '50px', padding: '8px', textAlign: 'center', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: '#FFFFFF' }}
                    />
                    <input
                      type="text"
                      placeholder="Title"
                      value={form.trustBadge4Title || ''}
                      onChange={(e) => handleChange('trustBadge4Title', e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: '#FFFFFF', fontWeight: 600, fontSize: '0.84rem' }}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Short description"
                    value={form.trustBadge4Desc || ''}
                    onChange={(e) => handleChange('trustBadge4Desc', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: '#FFFFFF', fontSize: '0.8rem' }}
                  />
                </div>
              </div>
              {renderScopedSaveControls('trustCards', isTrustCardsDirty)}
            </div>
          )}

          {/* TESTIMONIALS VISIBILITY */}
          {activeSection === 'testimonials' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Sparkles size={20} color="var(--accent-terracotta)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Testimonials Section
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '22px' }}>
                Control whether real customer reviews appear on the storefront. Reviews are not fabricated, and this section is off by default.
              </p>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-surface-soft)',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={form.showTestimonialsSection === true}
                  onChange={(e) => handleChange('showTestimonialsSection', e.target.checked)}
                  style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: 'var(--accent-terracotta)' }}
                />
                <span>
                  <span style={{ display: 'block', fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Show customer reviews on the storefront
                  </span>
                  <span style={{ display: 'block', marginTop: '3px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Displays up to three recent reviews from products that have review data. This is off by default.
                  </span>
                </span>
              </label>
              {renderScopedSaveControls('testimonials', isTestimonialsDirty)}
            </div>
          )}

          {activeSection === 'deliveryTimeline' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Truck size={20} color="var(--accent-terracotta)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Delivery Timeline Labels
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
                Rename the existing order milestones shown to customers. The order workflow stages and their recorded status events cannot be added or changed here.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: '14px' }}>
                {([
                  { field: 'deliveryStagePlacedLabel', label: 'Order placed' },
                  { field: 'deliveryStageConfirmedLabel', label: 'Confirmed' },
                  { field: 'deliveryStageInPreparationLabel', label: 'In preparation' },
                  { field: 'deliveryStageShippedLabel', label: 'Shipped' },
                  { field: 'deliveryStageOutForDeliveryLabel', label: 'Out for delivery' },
                  { field: 'deliveryStageDeliveredLabel', label: 'Delivered' }
                ] as const).map(stage => (
                  <label key={stage.field} style={{ display: 'grid', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {stage.label}
                    <input
                      type="text"
                      maxLength={40}
                      value={deliveryTimelineFormValues[stage.field]}
                      onChange={event => handleChange(stage.field, event.target.value)}
                      style={{
                        width: '100%',
                        minHeight: '42px',
                        padding: '9px 12px',
                        borderRadius: '9px',
                        border: '1px solid var(--border-medium)',
                        backgroundColor: '#FFFFFF',
                        color: 'var(--text-main)',
                        fontSize: '0.86rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </label>
                ))}
              </div>
              {renderScopedSaveControls('deliveryTimeline', isDeliveryTimelineDirty)}
            </div>
          )}

          {/* 6. CURRENCY & SHIPPING */}
          {activeSection === 'shipping' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Truck size={20} color="var(--accent-terracotta)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Currency & Shipping Logistics
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '22px' }}>
                Configure currency, delivery rates, free shipping, and the stock level that triggers low inventory alerts.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    Store Currency
                  </label>
                  <input
                    type="text"
                    value="₹ (INR)"
                    readOnly
                    aria-label="Store currency, Indian Rupee"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-medium)',
                      fontSize: '0.9rem'
                    }}
                  />
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.76rem', margin: '4px 0 0' }}>
                    Prices throughout the storefront and Studio are shown in Indian Rupees (INR).
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    Free Shipping Minimum Order ({form.currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.freeShippingThreshold}
                    onChange={(e) => handleChange('freeShippingThreshold', parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 299"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-medium)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    Fallback Delivery Charge ({form.currency})
                  </label>
                  <p style={{ margin: 0, padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-soft)', fontSize: '0.9rem' }}>
                    {form.currency}{deliveryPricingFormValues.fallback.charge.toFixed(2)} · {deliveryPricingFormValues.fallback.name}
                  </p>
                  <button type="button" onClick={() => navigateToSection('deliveryPricing')} style={{ marginTop: '5px', padding: 0, border: 0, background: 'none', color: 'var(--accent-terracotta)', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}>
                    Edit delivery pricing
                  </button>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    Shipping & Delivery Notice
                  </label>
                  <input
                    type="text"
                    value={form.shippingNotice || ''}
                    onChange={(e) => handleChange('shippingNotice', e.target.value)}
                    placeholder="e.g. Dispatched within 24-48 hours across India • Free Shipping above ₹299"
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
            </div>
          )}

          {activeSection === 'deliveryPricing' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Truck size={20} color="var(--accent-terracotta)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>Pincode Delivery Zones</h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '22px', lineHeight: 1.5 }}>
                Match six-digit Indian pincodes by prefix. Enter comma-separated prefixes or inclusive ranges such as <code>4000-4001, 402</code>. Longer matching prefixes take priority; exact pincode overrides take priority over zones. The fallback applies when no zone matches.
              </p>

              <div className="dashboard-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '22px' }}>
                <label style={{ display: 'grid', gap: '6px', fontSize: '0.82rem', fontWeight: 700 }}>
                  Fallback zone name
                  <input
                    type="text"
                    value={deliveryPricingFormValues.fallback.name}
                    onChange={event => handleChange('deliveryPricing', {
                      ...deliveryPricingFormValues,
                      fallback: { ...deliveryPricingFormValues.fallback, name: event.target.value }
                    })}
                    style={{ width: '100%', minHeight: '42px', padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--border-medium)', fontSize: '0.9rem' }}
                  />
                </label>
                <label style={{ display: 'grid', gap: '6px', fontSize: '0.82rem', fontWeight: 700 }}>
                  Fallback delivery charge ({form.currency})
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={deliveryPricingFormValues.fallback.charge}
                    onChange={event => handleChange('deliveryPricing', {
                      ...deliveryPricingFormValues,
                      fallback: { ...deliveryPricingFormValues.fallback, charge: Number(event.target.value) }
                    })}
                    style={{ width: '100%', minHeight: '42px', padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--border-medium)', fontSize: '0.9rem' }}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>Zones</h4>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const id = `delivery-zone-${crypto.randomUUID()}`;
                    handleChange('deliveryPricing', {
                      ...deliveryPricingFormValues,
                      zones: [...deliveryPricingFormValues.zones, { id, name: 'New zone', charge: 0, prefixRanges: [] }]
                    });
                    setDeliveryPrefixRangeDrafts(previous => ({ ...previous, [id]: '' }));
                  }}
                  style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                >
                  Add zone
                </button>
              </div>

              <div style={{ display: 'grid', gap: '12px' }}>
                {deliveryPricingFormValues.zones.map(zone => (
                  <div key={zone.id} style={{ padding: '16px', border: '1px solid var(--border-medium)', borderRadius: '12px', background: '#FFFEFC' }}>
                    <div className="dashboard-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
                      <label style={{ display: 'grid', gap: '5px', fontSize: '0.78rem', fontWeight: 700 }}>
                        Zone name
                        <input
                          type="text"
                          value={zone.name}
                          onChange={event => handleChange('deliveryPricing', {
                            ...deliveryPricingFormValues,
                            zones: deliveryPricingFormValues.zones.map(item => item.id === zone.id ? { ...item, name: event.target.value } : item)
                          })}
                          style={{ width: '100%', minHeight: '40px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '0.88rem' }}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: '5px', fontSize: '0.78rem', fontWeight: 700 }}>
                        Delivery charge ({form.currency})
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={zone.charge}
                          onChange={event => handleChange('deliveryPricing', {
                            ...deliveryPricingFormValues,
                            zones: deliveryPricingFormValues.zones.map(item => item.id === zone.id ? { ...item, charge: Number(event.target.value) } : item)
                          })}
                          style={{ width: '100%', minHeight: '40px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '0.88rem' }}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: '5px', fontSize: '0.78rem', fontWeight: 700, gridColumn: '1 / -1' }}>
                        Pincode prefixes / ranges
                        <input
                          type="text"
                          value={deliveryPrefixRangeDrafts[zone.id] ?? formatDeliveryPrefixRanges(zone.prefixRanges)}
                          onChange={event => {
                            const value = event.target.value;
                            setDeliveryPrefixRangeDrafts(previous => ({ ...previous, [zone.id]: value }));
                            const ranges = parseDeliveryPrefixRanges(value);
                            if (ranges) {
                              handleChange('deliveryPricing', {
                                ...deliveryPricingFormValues,
                                zones: deliveryPricingFormValues.zones.map(item => item.id === zone.id ? { ...item, prefixRanges: ranges } : item)
                              });
                            }
                          }}
                          placeholder="e.g. 4000-4001, 402"
                          style={{ width: '100%', minHeight: '40px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '0.88rem' }}
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('deliveryPricing', {
                          ...deliveryPricingFormValues,
                          zones: deliveryPricingFormValues.zones.filter(item => item.id !== zone.id)
                        });
                        setDeliveryPrefixRangeDrafts(previous => {
                          const next = { ...previous };
                          delete next[zone.id];
                          return next;
                        });
                      }}
                      style={{ marginTop: '10px', border: 0, padding: 0, background: 'none', color: '#B91C1C', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                      Remove zone
                    </button>
                  </div>
                ))}
                {deliveryPricingFormValues.zones.length === 0 && (
                  <p style={{ margin: 0, padding: '14px', border: '1px dashed var(--border-medium)', borderRadius: '10px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                    No zones configured. All non-free-shipping orders use the fallback charge.
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', margin: '24px 0 12px' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>Exact pincode overrides</h4>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleChange('deliveryPricing', {
                    ...deliveryPricingFormValues,
                    pincodeOverrides: [...deliveryPricingFormValues.pincodeOverrides, { pincode: '', charge: 0 }]
                  })}
                  style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                >
                  Add override
                </button>
              </div>
              <div style={{ display: 'grid', gap: '10px' }}>
                {deliveryPricingFormValues.pincodeOverrides.map((override, index) => (
                  <div key={`${override.pincode}-${index}`} className="dashboard-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr)) auto', gap: '10px', alignItems: 'end' }}>
                    <label style={{ display: 'grid', gap: '5px', fontSize: '0.78rem', fontWeight: 700 }}>
                      Six-digit pincode
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={override.pincode}
                        onChange={event => handleChange('deliveryPricing', {
                          ...deliveryPricingFormValues,
                          pincodeOverrides: deliveryPricingFormValues.pincodeOverrides.map((item, itemIndex) => itemIndex === index ? { ...item, pincode: event.target.value.replace(/\D/g, '').slice(0, 6) } : item)
                        })}
                        placeholder="e.g. 400001"
                        style={{ width: '100%', minHeight: '40px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '0.88rem' }}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: '5px', fontSize: '0.78rem', fontWeight: 700 }}>
                      Charge ({form.currency})
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={override.charge}
                        onChange={event => handleChange('deliveryPricing', {
                          ...deliveryPricingFormValues,
                          pincodeOverrides: deliveryPricingFormValues.pincodeOverrides.map((item, itemIndex) => itemIndex === index ? { ...item, charge: Number(event.target.value) } : item)
                        })}
                        style={{ width: '100%', minHeight: '40px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '0.88rem' }}
                      />
                    </label>
                    <button type="button" onClick={() => handleChange('deliveryPricing', {
                      ...deliveryPricingFormValues,
                      pincodeOverrides: deliveryPricingFormValues.pincodeOverrides.filter((_, itemIndex) => itemIndex !== index)
                    })} style={{ minHeight: '40px', border: 0, padding: '0 8px', background: 'none', color: '#B91C1C', fontWeight: 700, cursor: 'pointer' }}>
                      Remove
                    </button>
                  </div>
                ))}
                {deliveryPricingFormValues.pincodeOverrides.length === 0 && (
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>No exact pincode overrides configured.</p>
                )}
              </div>
              {renderScopedSaveControls('deliveryPricing', isDeliveryPricingDirty)}
            </div>
          )}

          {/* PRODUCT CARD BADGE PRIORITY */}
          {activeSection === 'productCards' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Sliders size={20} color="var(--accent-terracotta)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Product Card Badges
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '18px', lineHeight: 1.5 }}>
                Product cards show one qualifying badge. Set which badge takes priority below; the first eligible badge is displayed. Save this section independently from other Studio settings.
              </p>
              <div style={{ display: 'grid', gap: '10px' }}>
                {normalizeProductCardBadgePriority(form.productCardBadgePriority).map((badge, index, priority) => {
                  const label = PRODUCT_CARD_BADGES.find(option => option.id === badge)?.label || badge;
                  return (
                    <div
                      key={badge}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        flexWrap: 'wrap',
                        padding: '12px 14px',
                        border: '1px solid var(--border-light)',
                        borderRadius: '12px',
                        background: 'var(--bg-surface-soft)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: 'var(--accent-terracotta-light)',
                          color: 'var(--accent-terracotta)',
                          fontWeight: 800,
                          fontSize: '0.8rem'
                        }}>
                          {index + 1}
                        </span>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          {label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => moveBadgePriority(badge, -1)}
                          disabled={index === 0}
                          aria-label={`Move ${label} higher`}
                          style={{
                            minHeight: '40px',
                            padding: '7px 12px',
                            borderRadius: '9px',
                            border: '1px solid var(--border-medium)',
                            background: '#FFFFFF',
                            color: 'var(--text-main)',
                            fontWeight: 600,
                            cursor: index === 0 ? 'not-allowed' : 'pointer',
                            opacity: index === 0 ? 0.45 : 1
                          }}
                        >
                          Move up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveBadgePriority(badge, 1)}
                          disabled={index === priority.length - 1}
                          aria-label={`Move ${label} lower`}
                          style={{
                            minHeight: '40px',
                            padding: '7px 12px',
                            borderRadius: '9px',
                            border: '1px solid var(--border-medium)',
                            background: '#FFFFFF',
                            color: 'var(--text-main)',
                            fontWeight: 600,
                            cursor: index === priority.length - 1 ? 'not-allowed' : 'pointer',
                            opacity: index === priority.length - 1 ? 0.45 : 1
                          }}
                        >
                          Move down
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {renderScopedSaveControls('productCards', isBadgePriorityDirty)}
            </div>
          )}

          {/* LOW STOCK THRESHOLD */}
          {activeSection === 'lowStock' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Info size={20} color="var(--accent-terracotta)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Low Stock Threshold
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '18px', lineHeight: 1.5 }}>
                Set the stock quantity at or below which products are treated as low stock. This setting is saved independently from shipping rates and other Studio sections.
              </p>
              <label htmlFor="low-stock-threshold" style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 700,
                marginBottom: '6px'
              }}>
                Show low-stock badge at (units)
              </label>
              <input
                id="low-stock-threshold"
                type="number"
                min="0"
                step="1"
                value={form.lowStockThreshold ?? 5}
                onChange={(e) => handleChange('lowStockThreshold', Math.max(0, parseInt(e.target.value, 10) || 0))}
                style={{
                  width: '100%',
                  maxWidth: '320px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-medium)',
                  fontSize: '0.9rem'
                }}
              />
              {renderScopedSaveControls('lowStock', isLowStockThresholdDirty)}
            </div>
          )}

          {/* CASH ON DELIVERY ELIGIBILITY RULES */}
          {activeSection === 'cod' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: 'clamp(18px, 4vw, 28px)',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Truck size={20} color="var(--accent-terracotta)" />
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Cash on Delivery Eligibility
                  </h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '0.82rem', fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={form.paymentCodEnabled !== false}
                      onChange={e => handleChange('paymentCodEnabled', e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent-terracotta)' }}
                    />
                    COD globally enabled
                  </label>
                  <button
                    type="button"
                    onClick={addCodRule}
                    className="btn-secondary"
                    style={{ padding: '9px 14px', fontSize: '0.82rem' }}
                  >
                    + Add COD rule
                  </button>
                </div>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.55 }}>
                Control COD by individual product, existing product category, and selling-price range. Categories are managed in the product editor; rules apply automatically as products or prices change.
              </p>
              <div style={{ padding: '13px 15px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#334155', fontSize: '0.79rem', lineHeight: 1.5, marginBottom: '18px' }}>
                <strong>How rules combine:</strong> a product’s explicit COD choice wins. Otherwise, if any matching category/price rule denies COD, it is unavailable; with no matching deny rule COD remains allowed (when the global COD method is enabled). If a cart contains even one excluded product, COD is disabled for the entire cart.
              </div>

              {(form.codRules || []).length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', border: '1px dashed var(--border-medium)', borderRadius: '14px', color: 'var(--text-muted)' }}>
                  <strong style={{ display: 'block', color: 'var(--text-main)', marginBottom: '5px' }}>No category or price restrictions</strong>
                  COD is currently allowed for all products unless you change an individual product setting.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {(form.codRules || []).map((rule, index) => (
                    <div key={rule.id} style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 175px), 1fr))',
                      gap: '12px',
                      alignItems: 'end',
                      padding: '15px',
                      border: codRuleErrors[rule.id] ? '1px solid #DC2626' : '1px solid var(--border-medium)',
                      borderRadius: '14px',
                      background: 'var(--bg-surface-soft)'
                    }}>
                      <div>
                        <label htmlFor={`cod-rule-category-${rule.id}`} style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '5px' }}>
                          Category
                        </label>
                        <select
                          id={`cod-rule-category-${rule.id}`}
                          value={rule.category || ''}
                          onChange={e => updateCodRule(rule.id, { category: e.target.value || undefined })}
                          style={{ width: '100%', minHeight: '42px', padding: '8px 10px', borderRadius: '9px', border: '1px solid var(--border-medium)', background: '#FFFFFF', fontSize: '0.84rem' }}
                        >
                          <option value="">Any category</option>
                          {Array.from(new Set(products.map(product => product.category).filter(Boolean))).sort().map(category => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`cod-rule-min-${rule.id}`} style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '5px' }}>
                          Minimum price ({form.currency})
                        </label>
                        <input
                          id={`cod-rule-min-${rule.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="No minimum"
                          value={rule.minPrice ?? ''}
                          onChange={e => updateCodRule(rule.id, { minPrice: e.target.value === '' ? undefined : Number(e.target.value) })}
                          style={{ width: '100%', minHeight: '42px', boxSizing: 'border-box', padding: '8px 10px', borderRadius: '9px', border: '1px solid var(--border-medium)', fontSize: '0.84rem' }}
                        />
                      </div>
                      <div>
                        <label htmlFor={`cod-rule-max-${rule.id}`} style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '5px' }}>
                          Maximum price ({form.currency})
                        </label>
                        <input
                          id={`cod-rule-max-${rule.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="No maximum"
                          value={rule.maxPrice ?? ''}
                          onChange={e => updateCodRule(rule.id, { maxPrice: e.target.value === '' ? undefined : Number(e.target.value) })}
                          style={{ width: '100%', minHeight: '42px', boxSizing: 'border-box', padding: '8px 10px', borderRadius: '9px', border: '1px solid var(--border-medium)', fontSize: '0.84rem' }}
                        />
                      </div>
                      <div>
                        <label htmlFor={`cod-rule-action-${rule.id}`} style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '5px' }}>
                          COD for matches
                        </label>
                        <select
                          id={`cod-rule-action-${rule.id}`}
                          value={rule.availability}
                          onChange={e => updateCodRule(rule.id, { availability: e.target.value as CodRule['availability'] })}
                          style={{ width: '100%', minHeight: '42px', padding: '8px 10px', borderRadius: '9px', border: '1px solid var(--border-medium)', background: '#FFFFFF', fontSize: '0.84rem' }}
                        >
                          <option value="disabled">Do not allow COD</option>
                          <option value="enabled">Allow COD</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCodRule(rule.id)}
                        aria-label={`Remove COD rule ${index + 1}`}
                        style={{ minHeight: '42px', padding: '8px 12px', borderRadius: '9px', border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Remove rule
                      </button>
                      <div style={{ gridColumn: '1 / -1', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Choose a category and/or enter one or both price limits to target products. Matching rules that deny COD take precedence over other rules.
                      </div>
                      {codRuleErrors[rule.id] && (
                        <p role="alert" style={{ gridColumn: '1 / -1', color: '#DC2626', fontSize: '0.76rem', margin: 0 }}>
                          {codRuleErrors[rule.id]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* WHATSAPP SETTINGS */}
          {activeSection === 'whatsapp' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <MessageCircle size={20} color="#25D366" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  WhatsApp Click-to-Chat
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                Customize store contact details, checkout, support and order milestone messages. These settings open WhatsApp with a prefilled message; a person must press Send. Automatic message delivery requires a separate WhatsApp Business API integration.
              </p>

              <div style={{ display: 'grid', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={form.whatsappEnabled !== false}
                    onChange={(e) => handleChange('whatsappEnabled', e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#25D366' }}
                  />
                  Enable WhatsApp links throughout the store and dashboard
                </label>

                <div style={{ border: '1px solid var(--border-medium)', borderRadius: '12px', padding: '14px', display: 'grid', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={form.bulkOrderInquiryEnabled !== false}
                      onChange={event => handleChange('bulkOrderInquiryEnabled', event.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#25D366' }}
                    />
                    Show bulk order inquiries in the storefront footer
                  </label>
                  <div style={{ maxWidth: '320px' }}>
                    <label htmlFor="bulk-order-minimum-quantity" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                      Minimum bulk order quantity
                    </label>
                    <input
                      id="bulk-order-minimum-quantity"
                      type="number"
                      min="1"
                      step="1"
                      value={form.bulkOrderMinimumQuantity ?? 10}
                      onChange={event => handleChange('bulkOrderMinimumQuantity', Math.max(1, Math.floor(Number(event.target.value) || 1)))}
                      style={{ width: '100%', minHeight: '44px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '16px' }}
                    />
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '5px 0 0' }}>
                      Customers must request at least this many pieces. Inquiries use the WhatsApp business number above.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                      WhatsApp business number
                    </label>
                    <input
                      type="tel"
                      value={form.whatsappBusinessPhone || ''}
                      onChange={(e) => handleChange('whatsappBusinessPhone', e.target.value)}
                      placeholder={form.contactPhone || '+91 98765 43210'}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-medium)', backgroundColor: '#FFFFFF', fontSize: '0.88rem' }}
                    />
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '5px 0 0' }}>
                      Used for checkout orders and customer support. Leave blank to use Contact & Socials phone.
                    </p>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                      Default country calling code
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.whatsappCountryCode || '91'}
                      onChange={(e) => handleChange('whatsappCountryCode', e.target.value.replace(/\D/g, ''))}
                      placeholder="91"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-medium)', backgroundColor: '#FFFFFF', fontSize: '0.88rem' }}
                    />
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '5px 0 0' }}>
                      Used when a customer number is entered without a country code.
                    </p>
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={form.whatsappOrderButtonEnabled !== false}
                    onChange={(e) => handleChange('whatsappOrderButtonEnabled', e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#25D366' }}
                  />
                  Show “Order via WhatsApp” in the cart
                </label>

                <div style={{ borderTop: '1px dashed var(--border-medium)', paddingTop: '14px' }}>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 10px' }}>Order milestone message links</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                    {([
                      ['whatsappOrderReceivedEnabled', 'Order received'],
                      ['whatsappOrderConfirmedEnabled', 'Order confirmed'],
                      ['whatsappOrderShippedEnabled', 'Order shipped'],
                      ['whatsappOutForDeliveryEnabled', 'Out for delivery'],
                      ['whatsappOrderDeliveredEnabled', 'Order delivered'],
                      ['whatsappOrderCancelledEnabled', 'Order cancelled'],
                      ['whatsappCodReminderEnabled', 'COD reminder'],
                      ['whatsappSupportEnabled', 'Customer support link']
                    ] as const).map(([field, label]) => (
                      <label key={field} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={form[field] !== false}
                          onChange={(e) => handleChange(field, e.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: '#25D366' }}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ borderTop: '1px dashed var(--border-medium)', paddingTop: '14px' }}>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 4px' }}>Message templates</h4>
                  <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '0 0 12px' }}>
                    Available placeholders: {'{customer}'}, {'{orderId}'}, {'{store}'}, {'{currency}'}, {'{total}'}, {'{craftingDays}'}, {'{courier}'}, {'{trackingNumber}'}, {'{amountDue}'}, {'{cancelReason}'}. For order requests, also use {'{items}'} and {'{promo}'}.
                  </p>
                  {([
                    ['whatsappTemplateOrderInquiry', 'Cart order request', 'Hi! I would like to order from {store}:\n{items}\n{promo}Total: {currency}{total}\nPlease confirm availability.'],
                    ['whatsappTemplateOrderReceived', 'Order received', 'Hello {customer}! We received order #{orderId} at {store}. Total: {currency}{total}.'],
                    ['whatsappTemplateConfirmed', 'Order confirmed', 'Hello {customer}! Order #{orderId} at {store} is confirmed. Estimated dispatch in {craftingDays} days.'],
                    ['whatsappTemplateShipped', 'Order shipped', 'Hello {customer}! Order #{orderId} from {store} shipped via {courier}. Tracking AWB: {trackingNumber}.'],
                    ['whatsappTemplateOutForDelivery', 'Out for delivery', 'Hello {customer}! Order #{orderId} from {store} is out for delivery. Amount due: {amountDue}.'],
                    ['whatsappTemplateDelivered', 'Order delivered', 'Hello {customer}! Order #{orderId} from {store} was delivered. We hope you love it!'],
                    ['whatsappTemplateCancelled', 'Order cancelled', 'Hello {customer}, order #{orderId} at {store} was cancelled. Reason: {cancelReason}.'],
                    ['whatsappTemplateCodReminder', 'COD reminder', 'Hello {customer}! Order #{orderId} is out for delivery. Please keep {currency}{total} ready for COD.'],
                    ['whatsappTemplateSupport', 'Customer support', 'Hi, I have a question about order #{orderId}.']
                  ] as const).map(([field, label, placeholder]) => (
                    <div key={field} style={{ marginBottom: '12px' }}>
                      <label htmlFor={field} style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '5px' }}>{label}</label>
                      <textarea
                        id={field}
                        rows={field === 'whatsappTemplateOrderInquiry' ? 4 : 3}
                        value={form[field] || ''}
                        onChange={(e) => handleChange(field, e.target.value)}
                        placeholder={placeholder}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-medium)', fontFamily: 'inherit', fontSize: '0.82rem', resize: 'vertical' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* DIRECT UPI SETTINGS */}
          {activeSection === 'upi' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <QrCode size={20} color="var(--accent-terracotta)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Direct UPI Payment Details
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '22px' }}>
                Upload the QR image generated by your UPI or banking app. Customers will see this image and your UPI ID; this store does not generate or modify payment QR codes.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.86rem', fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={form.paymentUpiEnabled !== false}
                    onChange={(e) => handleChange('paymentUpiEnabled', e.target.checked)}
                    style={{ width: '17px', height: '17px', accentColor: 'var(--accent-terracotta)' }}
                  />
                  <span>{form.paymentUpiEnabled !== false ? 'Direct UPI is enabled' : 'Direct UPI is disabled'}</span>
                </label>

                <div>
                  <label htmlFor="studio-upi-payee-name" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    UPI Payee Name
                  </label>
                  <input
                    id="studio-upi-payee-name"
                    type="text"
                    autoComplete="organization"
                    maxLength={80}
                    value={form.upiPayeeName || ''}
                    onChange={e => handleChange('upiPayeeName', e.target.value)}
                    placeholder="e.g. Cozy Loops by Deepa"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-medium)',
                      backgroundColor: '#FFFFFF',
                      fontSize: '0.9rem'
                    }}
                  />
                  <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>
                    This name is shown to customers in UPI apps when they use the optional payment link.
                  </p>
                </div>

                <div>
                  <label htmlFor="studio-upi-id" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    UPI ID *
                  </label>
                  <input
                    id="studio-upi-id"
                    type="text"
                    required
                    autoComplete="off"
                    value={form.upiId || ''}
                    onChange={(e) => handleChange('upiId', e.target.value)}
                    placeholder="e.g. name@bank"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-medium)',
                      backgroundColor: '#FFFFFF',
                      fontSize: '0.9rem'
                    }}
                  />
                  <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>
                    Customers can copy this ID and pay manually from their UPI app.
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '8px' }}>
                    UPI QR code image *
                  </label>
                  <input
                    ref={upiQrFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={(e) => void handleUpiQrUpload(e)}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={isUpiQrUploading}
                    onClick={() => upiQrFileInputRef.current?.click()}
                    style={{ padding: '10px 16px', fontSize: '0.84rem', opacity: isUpiQrUploading ? 0.65 : 1 }}
                  >
                    <Upload size={16} />
                    <span>{isUpiQrUploading ? 'Uploading QR image…' : form.upiQrImage ? 'Replace QR image' : 'Upload QR image'}</span>
                  </button>
                  <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '7px 0 0' }}>
                    PNG, JPG, GIF, or WebP. Your QR image is uploaded using the same secure image storage as product photos.
                  </p>
                  {upiQrUploadError && (
                    <p role="alert" style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#B91C1C' }}>
                      {upiQrUploadError}
                    </p>
                  )}
                </div>

                {form.upiQrImage && (
                  <div style={{
                    width: 'min(100%, 300px)',
                    padding: '12px',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '14px',
                    background: '#FFFFFF'
                  }}>
                    <img
                      src={getAssetUrl(form.upiQrImage)}
                      alt="Preview of the uploaded Direct UPI QR code"
                      style={{ display: 'block', width: '100%', aspectRatio: '1', objectFit: 'contain' }}
                    />
                    <p style={{ margin: '8px 0 0', textAlign: 'center', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      QR image preview
                    </p>
                  </div>
                )}
              </div>

              {renderScopedSaveControls('upi', isUpiDetailsDirty)}
            </div>
          )}

          {activeSection === 'policies' && (
            <div className="glass-card" style={{ padding: 'clamp(16px, 3vw, 26px)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                  <FileText size={19} color="var(--accent-terracotta)" />
                  <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.18rem', fontWeight: 800 }}>Store policies</h3>
                </div>
                <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Edit the policy text customers can open at checkout. Current version: {settings.storePolicyVersion || 1}.
                </p>
              </div>

              <div role="note" className="badge-amber" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', whiteSpace: 'normal', textTransform: 'none', letterSpacing: 0, lineHeight: 1.5 }}>
                <ShieldAlert size={16} style={{ flex: '0 0 auto', marginTop: '2px' }} />
                <span>These are editable draft policies, not legal advice. Have an Indian consumer/privacy lawyer review them before relying on them.</span>
              </div>

              <div style={{ display: 'grid', gap: '10px' }}>
                {([
                  ['termsAndConditions', 'Terms & Conditions'],
                  ['refundReturnPolicy', 'Refund & Return Policy'],
                  ['privacyPolicy', 'Privacy Policy'],
                  ['shippingPolicy', 'Shipping Policy']
                ] as const).map(([field, label]) => (
                  <details key={field} className="glass-card" style={{ padding: '12px 14px' }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.88rem', fontWeight: 700 }}>
                      {label}
                    </summary>
                    <textarea
                      rows={10}
                      value={storePolicyFormValues[field]}
                      onChange={event => setForm(previous => ({
                        ...previous,
                        storePolicies: {
                          ...(previous.storePolicies || storePolicyFormValues),
                          [field]: event.target.value
                        }
                      }))}
                      aria-label={label}
                      style={{ width: '100%', boxSizing: 'border-box', marginTop: '12px', padding: '10px 12px', border: '1px solid var(--border-medium)', borderRadius: 8, fontFamily: 'inherit', fontSize: '0.84rem', lineHeight: 1.55, resize: 'vertical' }}
                    />
                    {field === 'shippingPolicy' && (
                      <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                        Keep <code>{'{{freeShippingThreshold}}'}</code> in the text to show the current Shipping & Inventory setting automatically.
                      </p>
                    )}
                  </details>
                ))}
              </div>

              <div role="note" className="badge-yarn" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', whiteSpace: 'normal', textTransform: 'none', letterSpacing: 0, lineHeight: 1.5 }}>
                <Info size={15} style={{ flex: '0 0 auto', marginTop: '2px' }} />
                <span>Legal review needed: avoid blanket rejection of genuine defect claims; add your grievance contact, response process, and data-retention details. The draft says free shipping above ₹599, while this store is currently set to {form.currency}{Number(form.freeShippingThreshold ?? 299)}; the customer policy placeholder follows the store setting.</span>
              </div>

              {renderScopedSaveControls('policies', isStorePoliciesDirty)}
            </div>
          )}

          {/* 7. PAYMENT GATEWAYS */}
          {activeSection === 'payments' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <CreditCard size={20} color="var(--accent-terracotta)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Payment Gateways & Cash on Delivery
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Configure Razorpay and PayU online payments, along with Cash on Delivery. Set up manual Direct UPI separately.
              </p>

              <div role="note" className="badge-amber" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', whiteSpace: 'normal', textTransform: 'none', letterSpacing: 0, lineHeight: 1.5, marginBottom: '18px' }}>
                <ShieldAlert size={16} style={{ flex: '0 0 auto', marginTop: '2px' }} />
                <span>All payment settings in this section are the Super Admin source of truth for live behavior. If a value differs from the environment, the saved Studio value wins. If credentials or passcodes still look stale, open Security &amp; Access Passcodes to fix the super admin/admin credentials or return to this section to re-save the payment configuration.</span>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setActiveSection('security')} style={{ alignSelf: 'flex-start', marginBottom: '18px', padding: '8px 12px', fontSize: '0.78rem' }}>
                Fix super admin or passcode conflicts
              </button>

              {/* CARD 1: RAZORPAY GATEWAY */}
              <div style={{
                backgroundColor: 'var(--bg-surface-soft)',
                border: '1.5px solid var(--border-medium)',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CreditCard size={20} color="#2563EB" />
                    <div>
                      <h4 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                        Razorpay Gateway (Cards, NetBanking, UPI, Wallets)
                      </h4>
                      <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                        Accept Debit Cards, Credit Cards, and NetBanking with automated payment verification.
                      </p>
                    </div>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(form.paymentRazorpayEnabled)}
                      onChange={(e) => handleChange('paymentRazorpayEnabled', e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent-terracotta)' }}
                    />
                    <span>{form.paymentRazorpayEnabled ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                      Razorpay Key ID
                    </label>
                    <input
                      type="text"
                      value={form.razorpayKeyId || ''}
                      onChange={(e) => handleChange('razorpayKeyId', e.target.value)}
                      placeholder="e.g. rzp_live_xxxxxxxx or rzp_test_xxxxxxxx"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-medium)',
                        backgroundColor: '#FFFFFF',
                        fontSize: '0.88rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                      Razorpay Key Secret
                    </label>
                    <input
                      type="password"
                      value={form.razorpayKeySecret || ''}
                      autoComplete="new-password"
                      onChange={(e) => { setClearRazorpaySecret(false); handleChange('razorpayKeySecret', e.target.value); }}
                      placeholder={form.razorpayKeySecretConfigured ? 'Saved securely — enter a new value to replace' : 'Enter Razorpay Key Secret'}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-medium)',
                        backgroundColor: '#FFFFFF',
                        fontSize: '0.88rem'
                      }}
                    />
                    {form.razorpayKeySecretConfigured && (
                      <button type="button" onClick={() => { setClearRazorpaySecret(value => !value); handleChange('razorpayKeySecret', ''); }} style={{ marginTop: '6px', border: 0, background: 'transparent', color: '#B91C1C', cursor: 'pointer', fontSize: '0.78rem' }}>
                        {clearRazorpaySecret ? 'Keep saved key' : 'Remove saved key'}
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: '16px', padding: '14px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid var(--border-medium)' }}>
                  <h5 style={{ margin: '0 0 6px', fontSize: '0.86rem' }}>Razorpay webhook (recommended)</h5>
                  <p style={{ margin: '0 0 10px', fontSize: '0.77rem', color: 'var(--text-muted)' }}>
                    In Razorpay Dashboard → Account &amp; Settings → Webhooks, add your site URL ending in <code>/api/webhooks/razorpay</code>, subscribe to <code>payment.captured</code>, then paste its secret here. Webhook URL must use HTTPS.
                  </p>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={form.razorpayWebhookSecret || ''}
                    onChange={(e) => { setClearRazorpayWebhookSecret(false); handleChange('razorpayWebhookSecret', e.target.value); }}
                    placeholder={form.razorpayWebhookSecretConfigured ? 'Saved securely — enter a new value to replace' : 'Enter webhook secret'}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-medium)', fontSize: '0.88rem' }}
                  />
                  {form.razorpayWebhookSecretConfigured && (
                    <button type="button" onClick={() => { setClearRazorpayWebhookSecret(value => !value); handleChange('razorpayWebhookSecret', ''); }} style={{ marginTop: '6px', border: 0, background: 'transparent', color: '#B91C1C', cursor: 'pointer', fontSize: '0.78rem' }}>
                      {clearRazorpayWebhookSecret ? 'Keep saved webhook secret' : 'Remove saved webhook secret'}
                    </button>
                  )}
                </div>
                <p style={{ margin: '12px 0 0', fontSize: '0.77rem', color: 'var(--text-muted)' }}>
                  Start with Razorpay test keys. Key secrets are write-only and never sent back to the browser. Enable the gateway and save before testing a checkout.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-secondary" disabled={isTestingRazorpay} onClick={async () => {
                    setRazorpayTestMessage('');
                    if (!await handleSave()) return;
                    setIsTestingRazorpay(true);
                    try {
                      await api.testRazorpaySettings();
                      setRazorpayTestMessage('Connection verified. Razorpay accepted these credentials.');
                    } catch (error) {
                      setRazorpayTestMessage(error instanceof Error ? error.message : 'Could not verify Razorpay credentials.');
                    } finally {
                      setIsTestingRazorpay(false);
                    }
                  }} style={{ padding: '9px 14px', fontSize: '0.82rem', opacity: isTestingRazorpay ? 0.65 : 1 }}>
                    {isTestingRazorpay ? 'Checking…' : 'Save & Test Razorpay'}
                  </button>
                  {razorpayTestMessage && <span role="status" style={{ fontSize: '0.8rem', color: razorpayTestMessage.startsWith('Connection verified') ? '#15803D' : '#B91C1C' }}>{razorpayTestMessage}</span>}
                </div>
              </div>

              {/* CARD 3: PAYU CHECKOUT */}
              <div style={{
                backgroundColor: 'var(--bg-surface-soft)',
                border: '1.5px solid var(--border-medium)',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CreditCard size={20} color="#7E22CE" />
                    <div>
                      <h4 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                        PayU Hosted Checkout
                      </h4>
                      <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                        Redirect customers to PayU and verify successful payments on the server.
                      </p>
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(form.paymentPayuEnabled)}
                      onChange={(e) => handleChange('paymentPayuEnabled', e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent-terracotta)' }}
                    />
                    <span>{form.paymentPayuEnabled ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontSize: '0.82rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={form.payuTestMode !== false}
                    onChange={(e) => handleChange('payuTestMode', e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent-terracotta)' }}
                  />
                  Use PayU test environment
                </label>
                {form.payuTestMode === false && (
                  <p role="alert" style={{ margin: '0 0 14px', padding: '10px 12px', borderRadius: '10px', background: '#FFF7ED', color: '#9A3412', fontSize: '0.78rem' }}>
                    Live payments are enabled for checkout. Confirm your live merchant credentials before saving.
                  </p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>PayU Merchant Key</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={form.payuMerchantKey || ''}
                      onChange={(e) => { setClearPayuCredentials(false); handleChange('payuMerchantKey', e.target.value); }}
                      placeholder={form.payuConfigured ? 'Saved securely — enter a new value to replace' : 'Enter PayU Merchant Key'}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-medium)', backgroundColor: '#FFFFFF', fontSize: '0.88rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>PayU Merchant Salt</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={form.payuMerchantSalt || ''}
                      onChange={(e) => { setClearPayuCredentials(false); handleChange('payuMerchantSalt', e.target.value); }}
                      placeholder={form.payuConfigured ? 'Saved securely — enter a new value to replace' : 'Enter PayU Merchant Salt'}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-medium)', backgroundColor: '#FFFFFF', fontSize: '0.88rem' }}
                    />
                  </div>
                </div>
                {form.payuConfigured && (
                  <button
                    type="button"
                    onClick={() => {
                      const removeCredentials = !clearPayuCredentials;
                      setClearPayuCredentials(removeCredentials);
                      if (removeCredentials) handleChange('paymentPayuEnabled', false);
                      handleChange('payuMerchantKey', '');
                      handleChange('payuMerchantSalt', '');
                    }}
                    style={{ marginTop: '8px', border: 0, background: 'transparent', color: '#B91C1C', cursor: 'pointer', fontSize: '0.78rem' }}
                  >
                    {clearPayuCredentials ? 'Keep saved PayU credentials' : 'Remove saved PayU credentials'}
                  </button>
                )}
                <p style={{ margin: '12px 0 0', fontSize: '0.76rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>
                  Credentials are encrypted before being saved and never returned to the browser. Set a stable server-only <code>PAYU_CREDENTIALS_ENCRYPTION_KEY</code> (at least 32 bytes) or <code>JWT_SECRET</code>. Configure <code>PAYU_CALLBACK_BASE_URL</code> as the backend’s public HTTPS URL so PayU can return payment results.
                </p>
              </div>

              {/* CARD 4: CASH ON DELIVERY (COD) */}
              <div style={{
                backgroundColor: 'var(--bg-surface-soft)',
                border: '1.5px solid var(--border-medium)',
                borderRadius: '16px',
                padding: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Truck size={20} color="#16A34A" />
                    <div>
                      <h4 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                        Cash on Delivery (COD)
                      </h4>
                      <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                        Allow patrons to pay cash upon receipt of their hand-stitched parcel.
                      </p>
                    </div>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={form.paymentCodEnabled !== false}
                      onChange={(e) => handleChange('paymentCodEnabled', e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent-terracotta)' }}
                    />
                    <span>{form.paymentCodEnabled !== false ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 8. CONTACT & SOCIALS */}
          {activeSection === 'contact' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <MessageCircle size={20} color="var(--accent-terracotta)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Studio Contact & Socials
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '22px' }}>
                Contact details displayed in the footer and order receipts for customer inquiries and custom orders.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    WhatsApp / Phone Number
                  </label>
                  <input
                    type="text"
                    value={form.contactPhone}
                    onChange={(e) => handleChange('contactPhone', e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-medium)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    Customer Support Email
                  </label>
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => handleChange('contactEmail', e.target.value)}
                    placeholder="e.g. cozyloops.deepa@gmail.com"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-medium)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    Instagram Handle
                  </label>
                  <input
                    type="text"
                    value={form.instagramHandle}
                    onChange={(e) => handleChange('instagramHandle', e.target.value)}
                    placeholder="e.g. @cozyloopsbydeepa"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-medium)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    Studio Location / City
                  </label>
                  <input
                    type="text"
                    value={form.studioLocation}
                    onChange={(e) => handleChange('studioLocation', e.target.value)}
                    placeholder="e.g. Handcrafted Studio, India"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-medium)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 8. FOOTER CONTENT */}
          {activeSection === 'footer' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Sliders size={20} color="var(--accent-terracotta)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Footer & Legal Customization
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '22px' }}>
                Personalize the blurb and copyright notice at the bottom of the customer page.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    Footer About Studio Blurb
                  </label>
                  <textarea
                    rows={2}
                    value={form.footerAboutText || ''}
                    onChange={(e) => handleChange('footerAboutText', e.target.value)}
                    placeholder="e.g. Cozy Loops by Deepa crafts slow-fashioned, joyful crochet hair accessories and gifts with organic soft cotton and gentle care."
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
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    Copyright Line
                  </label>
                  <input
                    type="text"
                    value={form.footerCopyright || ''}
                    onChange={(e) => handleChange('footerCopyright', e.target.value)}
                    placeholder="e.g. © 2026 Cozy Loops by Deepa. Handcrafted Slow Fashion. All Rights Reserved."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-medium)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 9. SECURITY & CREDENTIALS MANAGEMENT */}
          {activeSection === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Card 1: Super Admin Master Account */}
              <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '20px',
                padding: '28px',
                border: '1.5px solid #FCA5A5',
                boxShadow: '0 4px 20px rgba(220, 38, 38, 0.06)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      backgroundColor: '#FEF2F2', border: '1px solid #FECACA',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <ShieldCheck size={22} color="#DC2626" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                        Super Admin Master Account
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                        Full studio ownership privileges: theme customization, prices, payment gateways, and order operations.
                      </p>
                    </div>
                  </div>
                  <span style={{
                    backgroundColor: '#FEF2F2',
                    color: '#DC2626',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '999px',
                    border: '1px solid #FECACA'
                  }}>
                    👑 Full Master Access
                  </span>
                </div>

                <div style={{
                  marginTop: '16px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#FFF5F5',
                  border: '1px dashed #FECACA',
                  fontSize: '0.8rem',
                  color: '#991B1B',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                  <span>
                    When changed, the new password is saved to both the live database and your server <strong>.env</strong> file. All previous passwords become immediately invalid. Also note: payment config is managed here in Studio and is the master source of truth; if a payment setting looks stale, reopen Payment Gateways and save again after fixing the credential conflict.
                  </span>
                </div>

                <button type="button" className="btn-secondary" onClick={() => setActiveSection('payments')} style={{ marginTop: '14px', alignSelf: 'flex-start', padding: '8px 12px', fontSize: '0.78rem' }}>
                  Re-check payment configuration
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', marginTop: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                      Super Admin Username / ID
                    </label>
                    <div style={{ position: 'relative' }}>
                      <User size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-subtle)' }} />
                      <input
                        type="text"
                        value={superAdminIdInput}
                        onChange={(e) => setSuperAdminIdInput(e.target.value)}
                        placeholder="e.g. superadmin"
                        style={{
                          width: '100%',
                          padding: '10px 14px 10px 38px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-medium)',
                          fontSize: '0.9rem',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                      New Super Admin Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-subtle)' }} />
                      <input
                        type={showSuperAdminPw ? 'text' : 'password'}
                        value={newSuperAdminPassword}
                        onChange={(e) => setNewSuperAdminPassword(e.target.value)}
                        placeholder="Enter new master password (min 6 chars)..."
                        style={{
                          width: '100%',
                          padding: '10px 42px 10px 38px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-medium)',
                          fontSize: '0.9rem',
                          boxSizing: 'border-box'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSuperAdminPw(!showSuperAdminPw)}
                        style={{
                          position: 'absolute', right: 8, top: 8, width: 32, height: 32,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--text-subtle)', background: 'none', border: 'none', cursor: 'pointer'
                        }}
                      >
                        {showSuperAdminPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                      Confirm Master Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-subtle)' }} />
                      <input
                        type={showSuperAdminPw ? 'text' : 'password'}
                        value={confirmSuperAdminPassword}
                        onChange={(e) => setConfirmSuperAdminPassword(e.target.value)}
                        placeholder="Confirm new master password..."
                        style={{
                          width: '100%',
                          padding: '10px 14px 10px 38px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-medium)',
                          fontSize: '0.9rem',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Delivery Agent Access Passcode */}
              <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '20px',
                padding: '28px',
                border: '1.5px solid #93C5FD',
                boxShadow: '0 4px 20px rgba(37, 99, 235, 0.06)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Truck size={22} color="#2563EB" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                        Delivery Agent Passcode
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                        Restricted portal for field dispatchers and delivery drivers — no access to finances or catalog.
                      </p>
                    </div>
                  </div>
                  <span style={{
                    backgroundColor: '#EFF6FF',
                    color: '#1D4ED8',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '999px',
                    border: '1px solid #BFDBFE'
                  }}>
                    🚚 Field Delivery Only
                  </span>
                </div>

                <div style={{
                  marginTop: '16px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#F0F9FF',
                  border: '1px dashed #BAE6FD',
                  fontSize: '0.8rem',
                  color: '#0369A1',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Info size={16} style={{ flexShrink: 0 }} />
                  <span>
                    Delivery agents use this passcode to view dispatched orders, update tracking to <strong>Out for Delivery</strong> / <strong>Delivered</strong>, and trigger WhatsApp COD reminders. Set a unique passcode before enabling access.
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', marginTop: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                      New Delivery Agent Passcode
                    </label>
                    <div style={{ position: 'relative' }}>
                      <KeyRound size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-subtle)' }} />
                      <input
                        type={showDeliveryPasscode ? 'text' : 'password'}
                        value={newDeliveryPasscode}
                        onChange={(e) => setNewDeliveryPasscode(e.target.value)}
                        placeholder="Enter new delivery passcode (min 6 chars)..."
                        style={{
                          width: '100%',
                          padding: '10px 42px 10px 38px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-medium)',
                          fontSize: '0.9rem',
                          boxSizing: 'border-box'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowDeliveryPasscode(!showDeliveryPasscode)}
                        style={{
                          position: 'absolute', right: 8, top: 8, width: 32, height: 32,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--text-subtle)', background: 'none', border: 'none', cursor: 'pointer'
                        }}
                      >
                        {showDeliveryPasscode ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                      Confirm Delivery Passcode
                    </label>
                    <div style={{ position: 'relative' }}>
                      <KeyRound size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-subtle)' }} />
                      <input
                        type={showDeliveryPasscode ? 'text' : 'password'}
                        value={confirmDeliveryPasscode}
                        onChange={(e) => setConfirmDeliveryPasscode(e.target.value)}
                        placeholder="Confirm delivery passcode..."
                        style={{
                          width: '100%',
                          padding: '10px 14px 10px 38px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-medium)',
                          fontSize: '0.9rem',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: Optional Studio Staff Admin Passcode */}
              <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '20px',
                padding: '24px',
                border: '1px solid var(--border-medium)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <Lock size={18} color="var(--accent-terracotta)" />
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Studio Staff Admin Passcode (Optional)
                  </h4>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Secondary passcode for studio assistants who help manage products, craft queues, and catalog items.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                      New Studio Staff Passcode
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPasscode ? 'text' : 'password'}
                        value={newPasscode}
                        onChange={(e) => setNewPasscode(e.target.value)}
                        placeholder="Enter staff passcode..."
                        style={{
                          width: '100%',
                          padding: '10px 42px 10px 14px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-medium)',
                          fontSize: '0.88rem',
                          boxSizing: 'border-box'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasscode(!showPasscode)}
                        style={{
                          position: 'absolute', right: 8, top: 8, width: 32, height: 32,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--text-subtle)', background: 'none', border: 'none', cursor: 'pointer'
                        }}
                      >
                        {showPasscode ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                      Confirm Staff Passcode
                    </label>
                    <input
                      type={showPasscode ? 'text' : 'password'}
                      value={confirmPasscode}
                      onChange={(e) => setConfirmPasscode(e.target.value)}
                      placeholder="Confirm staff passcode..."
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-medium)',
                        fontSize: '0.88rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 10. DATABASE & BACKUP */}
          {activeSection === 'db' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Database size={20} color="var(--accent-terracotta)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Database Operations & Backup
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '22px' }}>
                Export your store database as JSON, reset catalog items, or load sample starter templates.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '18px', borderRadius: '14px', border: '1px solid var(--border-medium)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Export Store Backup</h4>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Download your entire database (products, offers, orders, settings) as a JSON file.</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const data = await fetch('/api/settings').then(r => r.json());
                      const products = await fetch('/api/products').then(r => r.json());
                      const offers = await fetch('/api/offers').then(r => r.json());
                      const orders = await fetch('/api/orders').then(r => r.json());
                      const backup = { settings: data, products, offers, orders };
                      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(blob);
                      a.download = `store_backup_${Date.now()}.json`;
                      a.click();
                    }}
                    className="btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '0.82rem' }}
                  >
                    <span>Download JSON Backup</span>
                  </button>
                </div>

                <div style={{ padding: '18px', borderRadius: '14px', border: '1px solid var(--border-medium)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Reload Starter Sample Template</h4>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Populate recommended slow-fashion products and starter offers.</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (confirm('Load sample starter catalog? This will add sample items to your store.')) {
                        await loadSampleTemplate();
                      }
                    }}
                    className="btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '0.82rem' }}
                  >
                    <span>Load Starter Sample Items</span>
                  </button>
                </div>

                <div style={{ padding: '18px', borderRadius: '14px', border: '1px solid #FCA5A5', backgroundColor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#991B1B' }}>Reset Catalog to Clean Empty State</h4>
                    <p style={{ fontSize: '0.78rem', color: '#B91C1C' }}>Clears all products and customer orders while keeping your brand settings.</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (confirm('Are you sure you want to clear all products and orders?')) {
                        await resetDatabase();
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      backgroundColor: '#DC2626',
                      color: '#FFFFFF',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none'
                    }}
                  >
                    <span>Clear Products & Orders</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Legacy sections retain their existing save flow until individually migrated. */}
          {!isScopedSettingSection(activeSection) && (
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              paddingTop: '8px'
            }}>
              <button
                type="button"
                onClick={() => handleSave()}
                className="btn-primary"
                style={{ padding: '12px 32px', fontSize: '0.92rem' }}
              >
                {savedSuccess ? <Check size={18} /> : <Save size={18} />}
                <span>{savedSuccess ? 'All Changes Saved!' : 'Save All Changes'}</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

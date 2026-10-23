import type {
  DeliveryChargeQuote,
  DeliveryDistancePricing,
  DeliveryPincodePrefixRange,
  DeliveryPricing,
  StoreSettings
} from '../types';

const PINCODE_PATTERN = /^[1-9]\d{5}$/;

export const extractIndianPincode = (value: string | undefined) =>
  [...(value ?? '').matchAll(/(?:^|\D)([1-9]\d{5})(?=\D|$)/g)].at(-1)?.[1] ?? '';

export const removeTrailingIndianPincode = (value: string, pincode: string) =>
  pincode && value.endsWith(pincode)
    ? value.slice(0, -pincode.length).replace(/[\s,;-]+$/, '').trim()
    : value.trim();

export const getDeliveryPricing = (
  pricing: DeliveryPricing | undefined,
  shippingFee: number
): DeliveryPricing => ({
  zones: pricing?.zones ?? [],
  fallback: pricing?.fallback ?? { name: 'Rest of India', charge: shippingFee },
  pincodeOverrides: pricing?.pincodeOverrides ?? []
});

const DELIVERY_DISTANCE_BANDS = [
  { label: '0–100 km', minKm: 0, maxKm: 100 },
  { label: '100–300 km', minKm: 100, maxKm: 300 },
  { label: '300–700 km', minKm: 300, maxKm: 700 },
  { label: '700+ km', minKm: 700, maxKm: null }
] as const;

export const getDeliveryDistancePricing = (
  pricing: DeliveryDistancePricing | undefined,
  fallbackCharge: number
): DeliveryDistancePricing => ({
  enabled: pricing?.enabled === true,
  originPincode: pricing?.originPincode ?? '831015',
  tiers: DELIVERY_DISTANCE_BANDS.map(band => {
    const savedTier = pricing?.tiers?.find(tier => tier.minKm === band.minKm && tier.maxKm === band.maxKm);
    return {
      ...band,
      charge: savedTier && Number.isFinite(savedTier.charge) && savedTier.charge >= 0
        ? savedTier.charge
        : fallbackCharge
    };
  })
});

export const validateDeliveryDistancePricing = (pricing: DeliveryDistancePricing): string | null => {
  if (pricing.enabled !== true && pricing.enabled !== false) {
    return 'Choose whether distance-based delivery pricing is enabled.';
  }
  if (!PINCODE_PATTERN.test(pricing.originPincode)) {
    return 'Enter a valid six-digit Indian store-origin pincode.';
  }
  if (pricing.tiers.length !== DELIVERY_DISTANCE_BANDS.length) {
    return 'All four distance bands need a delivery charge.';
  }
  for (let index = 0; index < DELIVERY_DISTANCE_BANDS.length; index += 1) {
    const expected = DELIVERY_DISTANCE_BANDS[index];
    const tier = pricing.tiers[index];
    if (
      tier.minKm !== expected.minKm ||
      tier.maxKm !== expected.maxKm ||
      !Number.isFinite(tier.charge) ||
      tier.charge < 0
    ) {
      return `Enter a non-negative charge for the ${expected.label} distance band.`;
    }
  }
  return null;
};

export const formatDeliveryPrefixRanges = (ranges: DeliveryPincodePrefixRange[]) =>
  ranges.map(({ startPrefix, endPrefix }) =>
    startPrefix === endPrefix ? startPrefix : `${startPrefix}-${endPrefix}`
  ).join(', ');

export const parseDeliveryPrefixRanges = (value: string): DeliveryPincodePrefixRange[] | null => {
  if (!value.trim()) return [];
  const ranges: DeliveryPincodePrefixRange[] = [];

  for (const part of value.split(',')) {
    const match = part.trim().match(/^([1-9]\d{0,5})(?:\s*-\s*([1-9]\d{0,5}))?$/);
    if (!match) return null;
    const startPrefix = match[1];
    const endPrefix = match[2] ?? startPrefix;
    if (startPrefix.length !== endPrefix.length || startPrefix > endPrefix) return null;
    ranges.push({ startPrefix, endPrefix });
  }

  return ranges;
};

export const validateDeliveryPricing = (pricing: DeliveryPricing): string | null => {
  if (!pricing.fallback.name.trim() || !Number.isFinite(pricing.fallback.charge) || pricing.fallback.charge < 0) {
    return 'Enter a fallback zone name and a non-negative delivery charge.';
  }

  const rangesByZone: { zoneId: string; zoneName: string; range: DeliveryPincodePrefixRange }[] = [];
  for (const zone of pricing.zones) {
    if (!zone.name.trim() || !Number.isFinite(zone.charge) || zone.charge < 0) {
      return 'Every zone needs a name and a non-negative delivery charge.';
    }
    if (zone.prefixRanges.length === 0) {
      return `Add at least one pincode prefix range to ${zone.name}.`;
    }
    for (const range of zone.prefixRanges) {
      if (
        !/^[1-9]\d{0,5}$/.test(range.startPrefix) ||
        !/^[1-9]\d{0,5}$/.test(range.endPrefix) ||
        range.startPrefix.length !== range.endPrefix.length ||
        range.startPrefix > range.endPrefix
      ) {
        return `Check the pincode prefix ranges in ${zone.name}. Each range must use same-length numeric prefixes in ascending order.`;
      }
      rangesByZone.push({ zoneId: zone.id, zoneName: zone.name, range });
    }
  }

  for (let index = 0; index < rangesByZone.length; index += 1) {
    const left = rangesByZone[index];
    for (let otherIndex = index + 1; otherIndex < rangesByZone.length; otherIndex += 1) {
      const right = rangesByZone[otherIndex];
      if (left.zoneId === right.zoneId || left.range.startPrefix.length !== right.range.startPrefix.length) continue;
      if (left.range.startPrefix <= right.range.endPrefix && right.range.startPrefix <= left.range.endPrefix) {
        return `Pincode ranges for ${left.zoneName} and ${right.zoneName} overlap. Adjust them so each prefix range belongs to one zone.`;
      }
    }
  }

  const seenPincodes = new Set<string>();
  for (const override of pricing.pincodeOverrides) {
    if (!PINCODE_PATTERN.test(override.pincode) || !Number.isFinite(override.charge) || override.charge < 0) {
      return 'Each pincode override needs a valid six-digit Indian pincode and a non-negative charge.';
    }
    if (seenPincodes.has(override.pincode)) return `Pincode ${override.pincode} has more than one override.`;
    seenPincodes.add(override.pincode);
  }

  return null;
};

export const calculateDeliveryCharge = (
  settings: Pick<StoreSettings, 'deliveryPricing' | 'shippingFee' | 'freeShippingThreshold'>,
  pincode: string,
  subtotal: number
): DeliveryChargeQuote => {
  const freeShippingThreshold = Math.max(0, Number(settings.freeShippingThreshold ?? 299));
  if (subtotal <= 0 || subtotal >= freeShippingThreshold) {
    return { amount: 0, isFreeShipping: true, zoneName: '', pricingMode: 'zones' };
  }

  const pricing = getDeliveryPricing(settings.deliveryPricing, Number(settings.shippingFee ?? 40));
  const override = pricing.pincodeOverrides.find(item => item.pincode === pincode);
  if (override) {
    return { amount: override.charge, isFreeShipping: false, zoneName: 'Pincode override', pricingMode: 'zones' };
  }

  const zone = pricing.zones
    .flatMap(item => item.prefixRanges.map(range => ({ zone: item, range })))
    .filter(({ range }) => {
      const prefix = pincode.slice(0, range.startPrefix.length);
      return prefix >= range.startPrefix && prefix <= range.endPrefix;
    })
    .sort((left, right) => right.range.startPrefix.length - left.range.startPrefix.length)[0]?.zone;

  return zone
    ? { amount: zone.charge, isFreeShipping: false, zoneName: zone.name, pricingMode: 'zones' }
    : { amount: pricing.fallback.charge, isFreeShipping: false, zoneName: pricing.fallback.name, pricingMode: 'zones' };
};

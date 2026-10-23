import { readFileSync } from 'node:fs';

const PINCODE_PATTERN = /^[1-9]\d{5}$/;
const PINCODE_COORDINATES = JSON.parse(
  readFileSync(new URL('./data/indian-pincode-coordinates.json', import.meta.url), 'utf8')
);
const EARTH_RADIUS_KM = 6371.0088;
const DISTANCE_BANDS = [
  { label: '0–100 km', minKm: 0, maxKm: 100 },
  { label: '100–300 km', minKm: 100, maxKm: 300 },
  { label: '300–700 km', minKm: 300, maxKm: 700 },
  { label: '700+ km', minKm: 700, maxKm: null }
];

const isValidCharge = value =>
  value !== null &&
  value !== undefined &&
  String(value).trim() !== '' &&
  Number.isFinite(Number(value)) &&
  Number(value) >= 0;

export const getPincodeCoordinates = pincode => {
  if (!PINCODE_PATTERN.test(String(pincode || ''))) return null;
  return Object.prototype.hasOwnProperty.call(PINCODE_COORDINATES, pincode)
    ? PINCODE_COORDINATES[pincode]
    : null;
};

export const getDeliveryDistancePricing = (settings, fallbackCharge) => {
  const pricing = settings.deliveryDistancePricing || {};
  return {
    enabled: pricing.enabled === true,
    originPincode: pricing.originPincode ?? '831015',
    tiers: DISTANCE_BANDS.map(band => {
      const savedTier = Array.isArray(pricing.tiers)
        ? pricing.tiers.find(tier => tier.minKm === band.minKm && tier.maxKm === band.maxKm)
        : null;
      return {
        ...band,
        charge: isValidCharge(savedTier?.charge) ? Number(savedTier.charge) : fallbackCharge
      };
    })
  };
};

export const validateDeliveryDistancePricing = pricing => {
  if (!pricing || typeof pricing !== 'object' || typeof pricing.enabled !== 'boolean') {
    return 'Distance pricing settings are invalid.';
  }
  if (!PINCODE_PATTERN.test(String(pricing.originPincode || ''))) {
    return 'Enter a valid six-digit Indian store-origin pincode.';
  }
  if (!getPincodeCoordinates(pricing.originPincode)) {
    return 'The store-origin pincode is not available in the coordinate dataset.';
  }
  if (!Array.isArray(pricing.tiers) || pricing.tiers.length !== DISTANCE_BANDS.length) {
    return 'All four distance bands need a delivery charge.';
  }
  for (let index = 0; index < DISTANCE_BANDS.length; index += 1) {
    const expected = DISTANCE_BANDS[index];
    const tier = pricing.tiers[index];
    if (
      tier?.minKm !== expected.minKm ||
      tier?.maxKm !== expected.maxKm ||
      !isValidCharge(tier?.charge)
    ) {
      return `Enter a non-negative charge for the ${expected.label} distance band.`;
    }
  }
  return null;
};

export const calculateHaversineDistanceKm = (origin, destination) => {
  const toRadians = degrees => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(destination[0] - origin[0]);
  const longitudeDelta = toRadians(destination[1] - origin[1]);
  const originLatitude = toRadians(origin[0]);
  const destinationLatitude = toRadians(destination[0]);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) * Math.cos(destinationLatitude) *
    Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
};

export const getDeliveryDistanceTier = (pricing, distanceKm) =>
  pricing.tiers.find(item =>
    distanceKm >= item.minKm && (item.maxKm === null || distanceKm < item.maxKm)
  );

export const calculateDeliveryQuote = (settings, pincode, subtotal) => {
  const freeShippingThreshold = Math.max(0, Number(settings.freeShippingThreshold ?? 299));
  const distancePricingEnabled = settings.deliveryDistancePricing?.enabled === true;
  if (subtotal <= 0 || subtotal >= freeShippingThreshold) {
    return {
      amount: 0,
      isFreeShipping: true,
      zoneName: '',
      pricingMode: distancePricingEnabled ? 'distance' : 'zones'
    };
  }

  const pricing = settings.deliveryPricing || {};
  const standardFee = Number(settings.shippingFee ?? 40);
  const fallbackCharge = isValidCharge(pricing.fallback?.charge)
    ? Number(pricing.fallback.charge)
    : isValidCharge(standardFee) ? standardFee : 40;
  const fallbackQuote = (zoneName = pricing.fallback?.name || 'Rest of India') => ({
    amount: fallbackCharge,
    isFreeShipping: false,
    zoneName,
    pricingMode: distancePricingEnabled ? 'distance' : 'zones'
  });
  if (!PINCODE_PATTERN.test(String(pincode || ''))) return fallbackQuote();

  const override = Array.isArray(pricing.pincodeOverrides)
    ? pricing.pincodeOverrides.find(item => item?.pincode === pincode && isValidCharge(item.charge))
    : null;
  if (override) {
    return {
      amount: Number(override.charge),
      isFreeShipping: false,
      zoneName: 'Pincode override',
      pricingMode: 'zones'
    };
  }

  if (distancePricingEnabled) {
    const distancePricing = getDeliveryDistancePricing(settings, fallbackCharge);
    const origin = getPincodeCoordinates(distancePricing.originPincode);
    const destination = getPincodeCoordinates(pincode);
    if (!origin || !destination) return fallbackQuote();

    const distanceKm = calculateHaversineDistanceKm(origin, destination);
    const tier = getDeliveryDistanceTier(distancePricing, distanceKm);
    return tier
      ? {
        amount: tier.charge,
        isFreeShipping: false,
        zoneName: tier.label,
        pricingMode: 'distance',
        distanceKm
      }
      : fallbackQuote();
  }

  const matchingZones = (Array.isArray(pricing.zones) ? pricing.zones : [])
    .flatMap(zone => (Array.isArray(zone?.prefixRanges) ? zone.prefixRanges : [])
      .filter(range =>
        /^[1-9]\d{0,5}$/.test(range?.startPrefix || '') &&
        /^[1-9]\d{0,5}$/.test(range?.endPrefix || '') &&
        range.startPrefix.length === range.endPrefix.length &&
        range.startPrefix <= range.endPrefix &&
        isValidCharge(zone.charge)
      )
      .filter(range => {
        const prefix = String(pincode).slice(0, range.startPrefix.length);
        return prefix >= range.startPrefix && prefix <= range.endPrefix;
      })
      .map(range => ({ zone, prefixLength: range.startPrefix.length })))
    .sort((left, right) => right.prefixLength - left.prefixLength);

  return matchingZones.length > 0
    ? {
      amount: Number(matchingZones[0].zone.charge),
      isFreeShipping: false,
      zoneName: matchingZones[0].zone.name,
      pricingMode: 'zones'
    }
    : fallbackQuote();
};

export const calculateDeliveryCharge = (settings, pincode, subtotal) =>
  calculateDeliveryQuote(settings, pincode, subtotal).amount;

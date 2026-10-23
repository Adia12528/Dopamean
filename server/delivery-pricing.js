const PINCODE_PATTERN = /^[1-9]\d{5}$/;

const isValidCharge = value =>
  value !== null &&
  value !== undefined &&
  String(value).trim() !== '' &&
  Number.isFinite(Number(value)) &&
  Number(value) >= 0;

export const calculateDeliveryCharge = (settings, pincode, subtotal) => {
  const freeShippingThreshold = Math.max(0, Number(settings.freeShippingThreshold ?? 299));
  if (subtotal <= 0 || subtotal >= freeShippingThreshold) return 0;

  const pricing = settings.deliveryPricing || {};
  const standardFee = Number(settings.shippingFee ?? 40);
  const fallbackCharge = isValidCharge(pricing.fallback?.charge)
    ? Number(pricing.fallback.charge)
    : isValidCharge(standardFee) ? standardFee : 40;
  if (!PINCODE_PATTERN.test(String(pincode || ''))) return fallbackCharge;

  const override = Array.isArray(pricing.pincodeOverrides)
    ? pricing.pincodeOverrides.find(item => item?.pincode === pincode && isValidCharge(item.charge))
    : null;
  if (override) return Number(override.charge);

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
    ? Number(matchingZones[0].zone.charge)
    : fallbackCharge;
};

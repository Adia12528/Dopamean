import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDeliveryCharge,
  calculateDeliveryQuote,
  calculateHaversineDistanceKm,
  getDeliveryDistanceTier,
  getPincodeCoordinates
} from './delivery-pricing.js';

const settings = {
  shippingFee: 40,
  freeShippingThreshold: 299,
  deliveryPricing: {
    fallback: { name: 'Rest of India', charge: 65 },
    zones: [
      {
        id: 'local',
        name: 'Local',
        charge: 25,
        prefixRanges: [{ startPrefix: '4000', endPrefix: '4001' }]
      },
      {
        id: 'metro',
        name: 'Metro Cities',
        charge: 45,
        prefixRanges: [
          { startPrefix: '110001', endPrefix: '110001' },
          { startPrefix: '560001', endPrefix: '560001' }
        ]
      },
      {
        id: 'remote',
        name: 'Remote',
        charge: 90,
        prefixRanges: [{ startPrefix: '781', endPrefix: '781' }]
      }
    ],
    pincodeOverrides: [{ pincode: '302001', charge: 35 }]
  }
};

test('calculates charges for real example pincodes from different Indian regions', () => {
  assert.equal(calculateDeliveryCharge(settings, '400001', 200), 25);
  assert.equal(calculateDeliveryCharge(settings, '110001', 200), 45);
  assert.equal(calculateDeliveryCharge(settings, '560001', 200), 45);
  assert.equal(calculateDeliveryCharge(settings, '781001', 200), 90);
  assert.equal(calculateDeliveryCharge(settings, '682001', 200), 65);
});

test('exact pincode overrides take precedence over zones and fallback', () => {
  assert.equal(calculateDeliveryCharge(settings, '302001', 200), 35);
});

test('free shipping threshold overrides all zone and pincode charges', () => {
  assert.equal(calculateDeliveryCharge(settings, '781001', 299), 0);
  assert.equal(calculateDeliveryCharge(settings, '302001', 500), 0);
});

test('most-specific matching prefix takes precedence', () => {
  const overlappingSpecificity = {
    ...settings,
    deliveryPricing: {
      ...settings.deliveryPricing,
      zones: [
        ...settings.deliveryPricing.zones,
        {
          id: 'specific',
          name: 'Specific Local',
          charge: 10,
          prefixRanges: [{ startPrefix: '40000', endPrefix: '40000' }]
        }
      ]
    }
  };
  assert.equal(calculateDeliveryCharge(overlappingSpecificity, '400001', 200), 10);
});

test('unmapped or invalid pincodes use fallback and legacy settings remain compatible', () => {
  assert.equal(calculateDeliveryCharge(settings, '999999', 200), 65);
  assert.equal(calculateDeliveryCharge(settings, '000000', 200), 65);
  assert.equal(calculateDeliveryCharge({ shippingFee: 40, freeShippingThreshold: 299 }, '400001', 200), 40);
  assert.equal(calculateDeliveryCharge({ shippingFee: 75, freeShippingThreshold: 299 }, '400001', 200), 75);
});

test('GeoNames coordinates cover the store and sample PINs with reasonable straight-line distances', () => {
  const origin = getPincodeCoordinates('831015');
  assert.deepEqual(origin, [22.5826, 86.4527]);
  assert.ok(Math.abs(calculateHaversineDistanceKm(origin, getPincodeCoordinates('700001')) - 195) < 2);
  assert.ok(Math.abs(calculateHaversineDistanceKm(origin, getPincodeCoordinates('781001')) - 657) < 2);
  assert.ok(Math.abs(calculateHaversineDistanceKm(origin, getPincodeCoordinates('110001')) - 1144) < 2);
  assert.ok(Math.abs(calculateHaversineDistanceKm(origin, getPincodeCoordinates('560001')) - 1401) < 2);
  assert.ok(Math.abs(calculateHaversineDistanceKm(origin, getPincodeCoordinates('400001')) - 1474) < 2);
});

test('distance tiers include exact boundaries in the next contiguous band', () => {
  const tiers = [
    { label: '0–100 km', minKm: 0, maxKm: 100, charge: 10 },
    { label: '100–300 km', minKm: 100, maxKm: 300, charge: 20 },
    { label: '300–700 km', minKm: 300, maxKm: 700, charge: 30 },
    { label: '700+ km', minKm: 700, maxKm: null, charge: 40 }
  ];
  assert.equal(getDeliveryDistanceTier({ tiers }, 99.99).charge, 10);
  assert.equal(getDeliveryDistanceTier({ tiers }, 100).charge, 20);
  assert.equal(getDeliveryDistanceTier({ tiers }, 300).charge, 30);
  assert.equal(getDeliveryDistanceTier({ tiers }, 700).charge, 40);
});

test('distance pricing is opt-in and uses the configured amount for the destination tier', () => {
  const distanceSettings = {
    ...settings,
    deliveryDistancePricing: {
      enabled: true,
      originPincode: '831015',
      tiers: [
        { label: '0–100 km', minKm: 0, maxKm: 100, charge: 10 },
        { label: '100–300 km', minKm: 100, maxKm: 300, charge: 20 },
        { label: '300–700 km', minKm: 300, maxKm: 700, charge: 30 },
        { label: '700+ km', minKm: 700, maxKm: null, charge: 40 }
      ]
    }
  };

  assert.deepEqual(calculateDeliveryQuote(distanceSettings, '831015', 200), {
    amount: 10,
    isFreeShipping: false,
    zoneName: '0–100 km',
    pricingMode: 'distance',
    distanceKm: 0
  });
  const kolkataQuote = calculateDeliveryQuote(distanceSettings, '700001', 200);
  assert.equal(kolkataQuote.amount, 20);
  assert.ok(Math.abs(kolkataQuote.distanceKm - 195) < 2);
  assert.equal(calculateDeliveryCharge(distanceSettings, '781001', 200), 30);
  assert.equal(calculateDeliveryCharge(distanceSettings, '110001', 200), 40);
});

test('distance pricing keeps free shipping and exact pincode overrides ahead of tiers', () => {
  const distanceSettings = {
    ...settings,
    deliveryDistancePricing: {
      enabled: true,
      originPincode: '831015',
      tiers: [
        { label: '0–100 km', minKm: 0, maxKm: 100, charge: 10 },
        { label: '100–300 km', minKm: 100, maxKm: 300, charge: 20 },
        { label: '300–700 km', minKm: 300, maxKm: 700, charge: 30 },
        { label: '700+ km', minKm: 700, maxKm: null, charge: 40 }
      ]
    }
  };
  assert.equal(calculateDeliveryCharge(distanceSettings, '302001', 200), 35);
  assert.equal(calculateDeliveryCharge(distanceSettings, '400001', 299), 0);
});

test('unknown destination or origin coordinates use the configured flat fallback', () => {
  const distanceSettings = {
    ...settings,
    deliveryDistancePricing: {
      enabled: true,
      originPincode: '999999',
      tiers: [
        { label: '0–100 km', minKm: 0, maxKm: 100, charge: 10 },
        { label: '100–300 km', minKm: 100, maxKm: 300, charge: 20 },
        { label: '300–700 km', minKm: 300, maxKm: 700, charge: 30 },
        { label: '700+ km', minKm: 700, maxKm: null, charge: 40 }
      ]
    }
  };
  assert.equal(getPincodeCoordinates('999999'), null);
  assert.equal(calculateDeliveryCharge(distanceSettings, '700001', 200), 65);
});

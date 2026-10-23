import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDeliveryCharge } from './delivery-pricing.js';

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

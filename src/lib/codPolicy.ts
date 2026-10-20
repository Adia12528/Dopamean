import type { CodRule, Product, StoreSettings } from '../types';

export const isProductCodEligible = (product: Product, rules: CodRule[] = []) => {
  if (product.codAvailability === 'enabled') return true;
  if (product.codAvailability === 'disabled') return false;

  const matchingRules = rules.filter(rule =>
    rule &&
    (!rule.category || rule.category === product.category) &&
    (rule.minPrice === undefined || product.price >= rule.minPrice) &&
    (rule.maxPrice === undefined || product.price <= rule.maxPrice)
  );

  return !matchingRules.some(rule => rule.availability === 'disabled');
};

export const isCartCodEligible = (products: Product[], settings: StoreSettings) =>
  settings.paymentCodEnabled !== false &&
  products.every(product => isProductCodEligible(product, settings.codRules || []));

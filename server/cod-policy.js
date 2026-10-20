export const isProductCodEligible = (product, rules = []) => {
  if (product.codAvailability === 'enabled') return true;
  if (product.codAvailability === 'disabled') return false;

  const matchingRules = rules.filter(rule =>
    rule &&
    (!rule.category || rule.category === product.category) &&
    (rule.minPrice === undefined || Number(product.price) >= Number(rule.minPrice)) &&
    (rule.maxPrice === undefined || Number(product.price) <= Number(rule.maxPrice))
  );

  return !matchingRules.some(rule => rule.availability === 'disabled');
};

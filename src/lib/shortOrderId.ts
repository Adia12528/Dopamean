export const getShortOrderId = (orderId: string): string => {
  const normalized = orderId.trim().toUpperCase();
  const readableReference = normalized.match(/^ORD-\d{8}-\d{4,}$/);
  if (readableReference) return readableReference[0];
  const legacyReference = normalized.match(/^(ORD-\d{8})-([A-Z0-9]{4})/);
  if (legacyReference) return `${legacyReference[1]}-${legacyReference[2]}`;
  const prefixedId = normalized.match(/^([A-Z]{2,4}-)([A-Z0-9]{8})/);
  return prefixedId ? `${prefixedId[1]}${prefixedId[2]}` : normalized.slice(0, 8);
};
export const createOrderReference = (createdAt = new Date(), sequence = 1) => {
  const date = createdAt.toISOString().slice(0, 10).replace(/-/g, '');
  const orderNumber = Number.isSafeInteger(sequence) && sequence > 0 ? sequence : 1;
  return `ORD-${date}-${String(orderNumber).padStart(4, '0')}`;
};
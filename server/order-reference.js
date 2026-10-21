import { randomBytes } from 'node:crypto';

export const createOrderReference = (createdAt = new Date()) => {
  const date = createdAt.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = randomBytes(8).toString('hex').toUpperCase();
  return `ORD-${date}-${suffix}`;
};
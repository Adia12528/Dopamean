import type { ProductCardBadge } from '../types';

export const PRODUCT_CARD_BADGES: { id: ProductCardBadge; label: string }[] = [
  { id: 'bestseller', label: 'Bestseller' },
  { id: 'discount', label: 'Discount' },
  { id: 'lowStock', label: 'Low stock' },
  { id: 'craftTime', label: 'Craft time' }
];

export const DEFAULT_PRODUCT_CARD_BADGE_PRIORITY: ProductCardBadge[] = [
  'bestseller',
  'discount',
  'lowStock',
  'craftTime'
];

export const normalizeProductCardBadgePriority = (value: unknown): ProductCardBadge[] => {
  const savedPriority = Array.isArray(value)
    ? value.filter((badge): badge is ProductCardBadge =>
      PRODUCT_CARD_BADGES.some(option => option.id === badge)
    )
    : [];
  const uniqueSavedPriority = [...new Set(savedPriority)];
  return [
    ...uniqueSavedPriority,
    ...DEFAULT_PRODUCT_CARD_BADGE_PRIORITY.filter(badge => !uniqueSavedPriority.includes(badge))
  ];
};

import type { Product } from '../types';

export interface ProductCategorySection {
  category: string;
  products: Product[];
  previewProducts: Product[];
  totalStock: number;
  previewLimit: number;
}

const compareBestsellerThenNewest = (left: Product, right: Product) => {
  const bestsellerDifference = Number(Boolean(right.isBestSeller)) - Number(Boolean(left.isBestSeller));
  if (bestsellerDifference !== 0) return bestsellerDifference;

  const leftDate = Date.parse(left.createdAt);
  const rightDate = Date.parse(right.createdAt);
  const dateDifference = (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0);
  return dateDifference || left.title.localeCompare(right.title);
};

export const buildProductCategorySections = (products: Product[]): ProductCategorySection[] => {
  const groups = new Map<string, Product[]>();

  for (const product of products) {
    const category = product.category.trim();
    if (!category) continue;
    const group = groups.get(category) || [];
    group.push(product);
    groups.set(category, group);
  }

  const sortedGroups = Array.from(groups, ([category, categoryProducts]) => ({
    category,
    products: categoryProducts.sort(compareBestsellerThenNewest),
    totalStock: categoryProducts.reduce((total, product) => total + Math.max(0, Number(product.stock) || 0), 0)
  })).sort((left, right) => right.totalStock - left.totalStock || left.category.localeCompare(right.category));

  const highestStock = sortedGroups[0]?.totalStock || 0;

  return sortedGroups.map(group => {
    const previewLimit = group.products.length === 1
      ? 1
      : highestStock > 0 && group.totalStock === highestStock ? 4 : 2;

    return {
      ...group,
      previewLimit,
      previewProducts: group.products.slice(0, previewLimit)
    };
  });
};
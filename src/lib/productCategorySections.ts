import type { Product } from '../types';

export interface ProductCategorySection {
  category: string;
  products: Product[];
  previewProducts: Product[];
  totalStock: number;
  previewLimit: number;
}

export interface ProductCategorySectionOptions {
  topStockPreviewCount?: number;
  otherPreviewCount?: number;
  sortOrder?: 'bestseller-newest' | 'newest-bestseller';
}

const compareNewest = (left: Product, right: Product) => {
  const leftDate = Date.parse(left.createdAt);
  const rightDate = Date.parse(right.createdAt);
  const dateDifference = (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0);
  return dateDifference;
};

const compareBestseller = (left: Product, right: Product) =>
  Number(Boolean(right.isBestSeller)) - Number(Boolean(left.isBestSeller));

export const buildProductCategorySections = (
  products: Product[],
  options: ProductCategorySectionOptions = {}
): ProductCategorySection[] => {
  const topStockPreviewCount = Math.max(1, Math.min(12, Math.floor(Number(options.topStockPreviewCount) || 4)));
  const otherPreviewCount = Math.max(1, Math.min(12, Math.floor(Number(options.otherPreviewCount) || 2)));
  const sortOrder = options.sortOrder || 'bestseller-newest';
  const compareProducts = sortOrder === 'newest-bestseller'
    ? (left: Product, right: Product) => compareNewest(left, right) || compareBestseller(left, right) || left.title.localeCompare(right.title)
    : (left: Product, right: Product) => compareBestseller(left, right) || compareNewest(left, right) || left.title.localeCompare(right.title);
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
    products: categoryProducts.sort(compareProducts),
    totalStock: categoryProducts.reduce((total, product) => total + Math.max(0, Number(product.stock) || 0), 0)
  })).sort((left, right) => right.totalStock - left.totalStock || left.category.localeCompare(right.category));

  return sortedGroups.map((group, index) => {
    const previewLimit = group.products.length === 1
      ? 1
      : index === 0 ? topStockPreviewCount : otherPreviewCount;

    return {
      ...group,
      previewLimit,
      previewProducts: group.products.slice(0, previewLimit)
    };
  });
};
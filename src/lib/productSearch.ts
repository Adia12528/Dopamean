import type { Product } from '../types';

const normalize = (value: string) =>
  value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const STOP_WORDS = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'the', 'to', 'with']);

const getProductFields = (product: Product) => [
  { value: product.title, weight: 10 },
  { value: product.category, weight: 8 },
  { value: product.tags.join(' '), weight: 8 },
  { value: product.yarnType, weight: 5 },
  { value: product.description, weight: 2 }
];

export const findExactProductMatches = (products: Product[], query: string) => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const queryTokens = normalizedQuery.split(/\s+/).filter(token => token.length > 1 && !STOP_WORDS.has(token));
  return products
    .map((product, index) => ({
      product,
      index,
      matches: getProductFields(product).some(field => normalize(field.value).includes(normalizedQuery)),
      score: getRelevanceScore(product, queryTokens)
    }))
    .filter(result => result.matches)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(result => result.product);
};

const editDistance = (left: string, right: string) => {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex];
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }
  return previous[right.length];
};

const tokenMatchScore = (queryToken: string, productToken: string) => {
  if (queryToken === productToken) return 1;
  if (productToken.includes(queryToken) && queryToken.length >= 3) return 0.88;
  if (queryToken.includes(productToken) && productToken.length >= 3) return 0.76;

  const maxDistance = queryToken.length >= 7 ? 2 : queryToken.length >= 4 ? 1 : 0;
  if (!maxDistance) return 0;
  const distance = editDistance(queryToken, productToken);
  return distance <= maxDistance ? 1 - distance / (maxDistance + 1) : 0;
};

const getRelevanceScore = (product: Product, queryTokens: string[]) => {
  const fields = getProductFields(product).map(field => ({
    ...field,
    tokens: normalize(field.value).split(/\s+/).filter(Boolean)
  }));

  let totalScore = 0;
  for (const queryToken of queryTokens) {
    let bestScore = 0;
    for (const field of fields) {
      const fieldMatch = Math.max(0, ...field.tokens.map(token => tokenMatchScore(queryToken, token)));
      bestScore = Math.max(bestScore, fieldMatch * field.weight);
    }
    if (bestScore === 0) return 0;
    totalScore += bestScore;
  }
  return totalScore / queryTokens.length;
};

export const findClosestProducts = (products: Product[], query: string, limit = 6) => {
  const queryTokens = normalize(query)
    .split(/\s+/)
    .filter(token => token.length > 1 && !STOP_WORDS.has(token));
  if (queryTokens.length === 0) return [];

  return products
    .map((product, index) => ({ product, index, score: getRelevanceScore(product, queryTokens) }))
    .filter(result => result.score >= 4)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map(result => result.product);
};

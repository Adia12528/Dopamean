import { api } from '../services/api';

export const cleanupUnusedImages = async (imageUrls: Array<string | null | undefined>) => {
  const uniqueUrls = [...new Set(imageUrls.filter((url): url is string => Boolean(url)))];
  const results = await Promise.all(uniqueUrls.map(url => api.deleteImage(url)));
  return {
    deleted: results.filter(result => result.deleted).length,
    retained: results.filter(result => result.referenced).length
  };
};

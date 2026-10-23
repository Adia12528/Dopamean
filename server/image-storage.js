export const IMAGE_UPLOAD_PURPOSES = Object.freeze({
  product: { maxBytes: 300 * 1024, label: 'Product images' },
  offer: { maxBytes: 1024 * 1024, label: 'Offer images' },
  storefront: { maxBytes: 5 * 1024 * 1024, label: 'Hero and storefront images' },
  'payment-qr': { maxBytes: 5 * 1024 * 1024, label: 'UPI QR images' }
});

export function getManagedImageObjectKey(value, supabaseUrlValue, bucketName) {
  try {
    const imageUrl = new URL(String(value || ''));
    const supabaseUrl = new URL(supabaseUrlValue);
    const prefix = `/storage/v1/object/public/${bucketName}/`;
    if (imageUrl.protocol !== 'https:' || imageUrl.origin !== supabaseUrl.origin || !imageUrl.pathname.startsWith(prefix)) {
      return null;
    }
    const encodedSegments = imageUrl.pathname.slice(prefix.length).split('/');
    const segments = encodedSegments.map(segment => decodeURIComponent(segment));
    if (
      segments.some(segment => !segment || segment === '.' || segment === '..' || segment.includes('/') || segment.includes('\\')) ||
      !(segments.length === 1 && /^crochet_[a-f0-9-]+\.(?:jpg|png|gif|webp)$/i.test(segments[0])) &&
      !(segments.length === 3 && segments[0] === 'legacy-migration' && /^[a-f0-9-]{36}$/i.test(segments[1]) && /^[A-Za-z0-9._-]+\.(?:jpg|png|gif|webp)$/i.test(segments[2]))
    ) {
      return null;
    }
    return segments.join('/');
  } catch {
    return null;
  }
}

export function containsImageReference(value, imageUrl) {
  if (typeof value === 'string') {
    if (value === imageUrl) return true;
    try {
      const referencedUrl = new URL(value);
      const candidateUrl = new URL(imageUrl);
      const normalizeStoragePath = pathname => pathname.replace(
        '/storage/v1/render/image/public/',
        '/storage/v1/object/public/'
      );
      if (
        referencedUrl.origin === candidateUrl.origin &&
        normalizeStoragePath(referencedUrl.pathname) === normalizeStoragePath(candidateUrl.pathname)
      ) {
        return true;
      }
    } catch {
      return false;
    }
  }
  if (Array.isArray(value)) return value.some(item => containsImageReference(item, imageUrl));
  if (value && typeof value === 'object') {
    return Object.values(value).some(item => containsImageReference(item, imageUrl));
  }
  return false;
}

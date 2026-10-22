export const getStorefrontImageUrl = (
  src: string,
  options: { width: number; height?: number; quality?: number }
): string => {
  if (!src || !src.includes('/storage/v1/object/public/')) return src;

  try {
    const url = new URL(src);
    if (!url.pathname.includes('/storage/v1/object/public/')) return src;

    url.pathname = url.pathname.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
    url.searchParams.set('width', String(Math.max(1, Math.round(options.width))));
    if (options.height) {
      url.searchParams.set('height', String(Math.max(1, Math.round(options.height))));
      url.searchParams.set('resize', 'cover');
    }
    url.searchParams.set('quality', String(Math.max(40, Math.min(90, Math.round(options.quality ?? 76)))));
    url.searchParams.set('format', 'webp');
    return url.toString();
  } catch (error) {
    if (error instanceof TypeError) return src;
    throw error;
  }
};

import React, { useState } from 'react';
import type { ImgHTMLAttributes } from 'react';
import { getStorefrontImageUrl } from '../../lib/storefrontImageUrl';

interface StorefrontImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height'> {
  src: string;
  width: number;
  height: number;
  transformWidth?: number;
  transformHeight?: number;
  quality?: number;
}

export const StorefrontImage: React.FC<StorefrontImageProps> = ({
  src,
  width,
  height,
  transformWidth = width,
  transformHeight,
  quality = 76,
  loading = 'lazy',
  decoding = 'async',
  className = '',
  style,
  onLoad,
  onError,
  ...imageProps
}) => {
  const optimizedSrc = getStorefrontImageUrl(src, {
    width: transformWidth,
    height: transformHeight,
    quality
  });
  const [imageState, setImageState] = useState({
    src,
    attemptedOriginal: false,
    loaded: false,
    failed: false
  });
  const stateMatchesSource = imageState.src === src;
  const attemptedOriginal = stateMatchesSource && imageState.attemptedOriginal;
  const currentSrc = attemptedOriginal ? src : optimizedSrc;
  const isLoaded = stateMatchesSource && imageState.loaded && !imageState.failed;
  const isFailed = stateMatchesSource && imageState.failed;
  const imageClassName = [
    'storefront-image',
    !isLoaded && !isFailed ? 'loading-skeleton' : '',
    isLoaded ? 'is-loaded' : '',
    isFailed ? 'is-failed' : '',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <img
      {...imageProps}
      className={imageClassName}
      src={currentSrc}
      width={width}
      height={height}
      loading={loading}
      decoding={decoding}
      style={style}
      onLoad={event => {
        setImageState(previous => ({
          src,
          attemptedOriginal: previous.src === src && previous.attemptedOriginal,
          loaded: true,
          failed: false
        }));
        onLoad?.(event);
      }}
      onError={event => {
        if (optimizedSrc !== src && !attemptedOriginal) {
          setImageState({ src, attemptedOriginal: true, loaded: false, failed: false });
        } else {
          setImageState({ src, attemptedOriginal, failed: true, loaded: false });
          onError?.(event);
        }
      }}
    />
  );
};

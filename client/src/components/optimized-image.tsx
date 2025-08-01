import { useState, useRef, useEffect } from 'react';
import { useLazyImage } from '@/hooks/use-lazy-image';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  thumbnailSize?: 'small' | 'medium' | 'large';
  quality?: 'low' | 'medium' | 'high';
  aspectRatio?: 'square' | 'auto';
  onLoad?: () => void;
  onError?: () => void;
  loading?: 'lazy' | 'eager';
  placeholder?: boolean;
}

const THUMBNAIL_SIZES = {
  small: 150,
  medium: 300,
  large: 600
} as const;

const QUALITY_VALUES = {
  low: 60,
  medium: 80,
  high: 95
} as const;

export function OptimizedImage({
  src,
  alt,
  className,
  thumbnailSize = 'medium',
  quality = 'medium',
  aspectRatio = 'auto',
  onLoad,
  onError,
  loading = 'lazy',
  placeholder = true
}: OptimizedImageProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showHighQuality, setShowHighQuality] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Generate optimized image URL
  const getOptimizedSrc = (originalSrc: string, requestedQuality?: string) => {
    if (!originalSrc) return '';
    
    const size = THUMBNAIL_SIZES[thumbnailSize];
    const qualityValue = requestedQuality ? parseInt(requestedQuality) : QUALITY_VALUES[quality];
    
    // Check if the src is already an API route
    if (originalSrc.startsWith('/api/files/')) {
      // Add thumbnail parameters to existing API route
      try {
        const url = new URL(originalSrc, window.location.origin);
        url.searchParams.set('quality', requestedQuality || quality);
        url.searchParams.set('w', size.toString());
        url.searchParams.set('h', size.toString());
        return url.pathname + url.search;
      } catch {
        return originalSrc;
      }
    }
    
    return originalSrc; // Return original if not an API route
  };

  const optimizedSrc = getOptimizedSrc(src);
  const lowQualitySrc = getOptimizedSrc(src, '30');
  
  const {
    ref: lazyRef,
    isLoaded: lazyIsLoaded,
    isInView,
    imageSrc
  } = useLazyImage({ 
    src: loading === 'lazy' ? optimizedSrc : '', 
    threshold: 0.1 
  });

  const shouldLoadEagerly = loading === 'eager';
  const finalImageSrc = shouldLoadEagerly ? optimizedSrc : imageSrc;

  useEffect(() => {
    if (finalImageSrc && imgRef.current) {
      const img = imgRef.current;
      
      const handleLoad = () => {
        setIsLoading(false);
        onLoad?.();
      };
      
      const handleError = () => {
        setImageError(true);
        setIsLoading(false);
        onError?.();
      };

      img.addEventListener('load', handleLoad);
      img.addEventListener('error', handleError);

      return () => {
        img.removeEventListener('load', handleLoad);
        img.removeEventListener('error', handleError);
      };
    }
  }, [finalImageSrc, onLoad, onError]);

  useEffect(() => {
    if (lazyIsLoaded && !isLoading) {
      // Delay before loading high quality image
      const timer = setTimeout(() => {
        setShowHighQuality(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [lazyIsLoaded, isLoading]);

  if (imageError) {
    return (
      <div className={cn(
        "flex items-center justify-center bg-muted text-muted-foreground",
        aspectRatio === 'square' && "aspect-square",
        className
      )}>
        <div className="text-center">
          <div className="text-sm">Failed to load image</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={loading === 'lazy' ? lazyRef : undefined}
      className={cn(
        "relative overflow-hidden",
        aspectRatio === 'square' && "aspect-square",
        className
      )}
    >
      {/* Placeholder */}
      {placeholder && (isLoading || (loading === 'lazy' && !isInView)) && (
        <div className={cn(
          "absolute inset-0 bg-muted animate-pulse",
          aspectRatio === 'square' && "aspect-square"
        )} />
      )}

      {/* Low quality image for progressive loading */}
      {loading === 'lazy' && isInView && !showHighQuality && (
        <img
          src={lowQualitySrc}
          alt={alt}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
            aspectRatio === 'square' && "aspect-square"
          )}
          style={{ filter: 'blur(2px)' }}
        />
      )}

      {/* Main optimized image */}
      {finalImageSrc && (shouldLoadEagerly || (loading === 'lazy' && (showHighQuality || isInView))) && (
        <img
          ref={imgRef}
          src={showHighQuality ? finalImageSrc : (shouldLoadEagerly ? finalImageSrc : lowQualitySrc)}
          alt={alt}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            aspectRatio === 'square' && "aspect-square",
            isLoading && "opacity-0"
          )}
          style={{
            filter: (!shouldLoadEagerly && !showHighQuality) ? 'blur(2px)' : undefined
          }}
        />
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
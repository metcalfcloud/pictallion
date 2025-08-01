import { useState } from 'react';
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
  medium: 250,
  large: 400
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
  loading = 'eager',
  placeholder = false // Disable placeholder for instant loading
}: OptimizedImageProps) {
  const [imageError, setImageError] = useState(false);

  // Generate optimized image URL
  const getOptimizedSrc = (originalSrc: string) => {
    if (!originalSrc) return '';
    
    const size = THUMBNAIL_SIZES[thumbnailSize];
    
    // Check if the src is already an API route
    if (originalSrc.startsWith('/api/files/')) {
      // Add thumbnail parameters to existing API route
      try {
        const url = new URL(originalSrc, window.location.origin);
        url.searchParams.set('quality', 'low'); // Force low quality for speed
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
    <div className={cn(
      "relative overflow-hidden bg-muted",
      aspectRatio === 'square' && "aspect-square",
      className
    )}>
      <img
        src={optimizedSrc}
        alt={alt}
        className={cn(
          "w-full h-full object-cover",
          aspectRatio === 'square' && "aspect-square"
        )}
        onLoad={onLoad}
        onError={() => {
          setImageError(true);
          onError?.();
        }}
        decoding="async"
        loading="eager"
      />
    </div>
  );
}
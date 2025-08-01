import { useEffect, useRef } from 'react';

interface UseImagePreloaderProps {
  images: string[];
  preloadCount?: number;
}

export function useImagePreloader({ images, preloadCount = 10 }: UseImagePreloaderProps) {
  const preloadedImages = useRef(new Set<string>());
  
  useEffect(() => {
    // Preload the next batch of images
    const imagesToPreload = images.slice(0, preloadCount);
    
    imagesToPreload.forEach(src => {
      if (!preloadedImages.current.has(src) && src) {
        const img = new Image();
        img.loading = 'eager';
        img.src = src;
        preloadedImages.current.add(src);
        
        // Optional: Remove from cache after successful load to free memory
        img.onload = () => {
          // Keep in cache for now
        };
        
        img.onerror = () => {
          preloadedImages.current.delete(src);
        };
      }
    });
  }, [images, preloadCount]);
  
  return {
    preloadedCount: preloadedImages.current.size
  };
}
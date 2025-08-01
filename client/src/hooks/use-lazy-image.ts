import { useState, useEffect, useRef } from 'react';

interface UseLazyImageProps {
  src: string;
  threshold?: number;
}

interface UseLazyImageReturn {
  ref: React.RefObject<HTMLImageElement>;
  isLoaded: boolean;
  isInView: boolean;
  imageSrc: string | undefined;
}

export function useLazyImage({ src, threshold = 0.1 }: UseLazyImageProps): UseLazyImageReturn {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | undefined>();
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const current = ref.current;
    if (!current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          setImageSrc(src);
          observer.unobserve(current);
        }
      },
      { threshold }
    );

    observer.observe(current);

    return () => {
      if (current) {
        observer.unobserve(current);
      }
    };
  }, [src, threshold]);

  useEffect(() => {
    if (imageSrc && !isLoaded) {
      const img = new Image();
      img.onload = () => setIsLoaded(true);
      img.onerror = () => setIsLoaded(false);
      img.src = imageSrc;
    }
  }, [imageSrc, isLoaded]);

  return {
    ref,
    isLoaded,
    isInView,
    imageSrc: isInView ? imageSrc : undefined
  };
}
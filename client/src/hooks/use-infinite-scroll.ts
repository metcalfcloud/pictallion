import { useState, useEffect, useCallback, useRef } from 'react';

interface UseInfiniteScrollProps<T> {
  data: T[];
  itemsPerPage?: number;
  threshold?: number;
}

interface UseInfiniteScrollReturn<T> {
  displayedItems: T[];
  hasMore: boolean;
  loadMore: () => void;
  isLoading: boolean;
  reset: () => void;
}

export function useInfiniteScroll<T>({
  data,
  itemsPerPage = 20,
  threshold = 0.8
}: UseInfiniteScrollProps<T>): UseInfiniteScrollReturn<T> {
  const [currentIndex, setCurrentIndex] = useState(itemsPerPage);
  const [isLoading, setIsLoading] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const displayedItems = data.slice(0, currentIndex);
  const hasMore = currentIndex < data.length;

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) return;
    
    setIsLoading(true);
    // Simulate brief loading for smooth UX
    setTimeout(() => {
      setCurrentIndex(prev => Math.min(prev + itemsPerPage, data.length));
      setIsLoading(false);
    }, 100);
  }, [hasMore, isLoading, itemsPerPage, data.length]);

  const reset = useCallback(() => {
    setCurrentIndex(itemsPerPage);
  }, [itemsPerPage]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold }
    );

    observerRef.current.observe(sentinelRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoading, loadMore, threshold]);

  // Reset when data changes
  useEffect(() => {
    reset();
  }, [data, reset]);

  // Attach sentinel ref to a function for external use
  const setSentinelRef = useCallback((node: HTMLDivElement | null) => {
    sentinelRef.current = node;
  }, []);

  return {
    displayedItems,
    hasMore,
    loadMore,
    isLoading,
    reset,
    sentinelRef: setSentinelRef
  };
}
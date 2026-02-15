import { useState, useRef, useCallback } from 'react';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
}

/**
 * Hook for pull-to-refresh behavior on touch devices.
 * Returns state and touch handlers to attach to the scrollable container.
 */
export function usePullToRefresh({ onRefresh, threshold = 80 }: PullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const isAtTop = useRef(true);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Only engage if scrolled to top
    isAtTop.current = window.scrollY <= 0;
    if (isAtTop.current && !isRefreshing) {
      touchStartY.current = e.touches[0].clientY;
    }
  }, [isRefreshing]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null || !isAtTop.current || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;

    if (diff > 0) {
      // Apply resistance: diminishing returns as you pull further
      const dampened = Math.min(diff * 0.4, threshold * 1.5);
      setPullDistance(dampened);
    }
  }, [threshold, isRefreshing]);

  const onTouchEnd = useCallback(async () => {
    if (touchStartY.current === null) return;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold * 0.5); // Snap to loading position
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }

    touchStartY.current = null;
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  return {
    pullDistance,
    isRefreshing,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}

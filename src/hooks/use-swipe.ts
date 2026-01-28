import { useRef, useCallback } from 'react';

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

interface UseSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

interface SwipeState {
  startX: number | null;
  endX: number | null;
  isSwiping: boolean;
}

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 50 }: UseSwipeOptions): SwipeHandlers {
  // Single ref to avoid hook count issues with HMR
  const swipeState = useRef<SwipeState>({ startX: null, endX: null, isSwiping: false });

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    swipeState.current.startX = e.touches[0].clientX;
    swipeState.current.endX = null;
    swipeState.current.isSwiping = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (swipeState.current.startX === null) return;
    
    swipeState.current.endX = e.touches[0].clientX;
    const deltaX = swipeState.current.endX - swipeState.current.startX;
    
    // Mark as swiping only if we've moved past a small threshold
    if (Math.abs(deltaX) > 10) {
      swipeState.current.isSwiping = true;
    }
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const { startX, endX, isSwiping } = swipeState.current;
    
    // Only process if we actually swiped (not just a tap)
    if (!isSwiping || startX === null || endX === null) {
      swipeState.current = { startX: null, endX: null, isSwiping: false };
      return;
    }

    const deltaX = endX - startX;

    if (Math.abs(deltaX) > threshold) {
      // Prevent the tap from also firing
      e.preventDefault();
      
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    swipeState.current = { startX: null, endX: null, isSwiping: false };
  }, [onSwipeLeft, onSwipeRight, threshold]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}

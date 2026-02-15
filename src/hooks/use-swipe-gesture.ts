import { useRef, useCallback } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

interface SwipeOptions {
  threshold?: number;
  maxVerticalMovement?: number;
}

/**
 * Hook for detecting horizontal swipe gestures on touch devices.
 * Returns ref callbacks to attach to the swipeable element.
 */
export function useSwipeGesture(
  handlers: SwipeHandlers,
  options: SwipeOptions = {}
) {
  const { threshold = 50, maxVerticalMovement = 80 } = options;
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = Math.abs(touch.clientY - touchStart.current.y);

      // Only trigger if horizontal movement is dominant
      if (Math.abs(dx) > threshold && dy < maxVerticalMovement) {
        if (dx > 0 && handlers.onSwipeRight) {
          handlers.onSwipeRight();
        } else if (dx < 0 && handlers.onSwipeLeft) {
          handlers.onSwipeLeft();
        }
      }

      touchStart.current = null;
    },
    [handlers, threshold, maxVerticalMovement]
  );

  return { onTouchStart, onTouchEnd };
}

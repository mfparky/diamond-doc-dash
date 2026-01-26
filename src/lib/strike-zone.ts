// Strike zone constants based on MLB specifications
// Zone width: 17" plate + 2.94" ball diameter = 19.94" effective width
// Zone height: 42.61" top - 19.76" bottom + 2.94" ball = 25.79" effective height
// Ball radius: 1.47" (half of 2.94" diameter)

export const STRIKE_ZONE = {
  // Actual measurements in inches
  PLATE_WIDTH: 17,
  BALL_DIAMETER: 2.94,
  ZONE_WIDTH: 19.94, // 17 + 2.94
  ZONE_HEIGHT: 25.79, // 44.08 - 18.29

  // Aspect ratio (width / height)
  ASPECT_RATIO: 19.94 / 25.79, // ≈ 0.773

  // Normalized strike zone boundaries (-1 to 1 coordinate system)
  // The zone box is centered horizontally and vertically proportioned
  // Ball touching edge = strike, so we account for ball radius
  ZONE_LEFT: -0.4,
  ZONE_RIGHT: 0.4,
  ZONE_BOTTOM: -0.45,
  ZONE_TOP: 0.45,

  // Ball radius in normalized coordinates (for edge detection)
  // A pitch is a strike if any part of the ball touches the zone
  BALL_RADIUS_NORMALIZED: 0.07, // Approximately 1.47" / 19.94" ≈ 0.074
} as const;

/**
 * Check if a pitch location is a strike
 * A pitch is a strike if ANY part of the ball touches the strike zone
 */
export function isStrike(x: number, y: number): boolean {
  const ballRadius = STRIKE_ZONE.BALL_RADIUS_NORMALIZED;

  // Check if the ball (circle) intersects with the strike zone (rectangle)
  // The pitch location is the center of the ball
  const closestX = Math.max(STRIKE_ZONE.ZONE_LEFT, Math.min(x, STRIKE_ZONE.ZONE_RIGHT));
  const closestY = Math.max(STRIKE_ZONE.ZONE_BOTTOM, Math.min(y, STRIKE_ZONE.ZONE_TOP));

  // Calculate distance from pitch center to closest point on zone
  const distanceX = x - closestX;
  const distanceY = y - closestY;
  const distanceSquared = distanceX * distanceX + distanceY * distanceY;

  // If distance is less than ball radius, it's a strike
  return distanceSquared <= ballRadius * ballRadius;
}

/**
 * Get container size classes with proper aspect ratio
 */
export function getZoneSizeClasses(size: 'sm' | 'md' | 'lg'): string {
  // Width classes and calculated heights based on aspect ratio (~0.773)
  // Height should be width / 0.773
  const sizes = {
    sm: 'w-48',   // 12rem width → ~15.5rem height (248px)
    md: 'w-64',   // 16rem width → ~20.7rem height (331px)
    lg: 'w-80',   // 20rem width → ~25.9rem height (414px)
  };
  return sizes[size];
}

/**
 * Get inline styles for proper aspect ratio
 */
export function getZoneAspectStyle(): React.CSSProperties {
  return {
    aspectRatio: `${STRIKE_ZONE.ZONE_WIDTH} / ${STRIKE_ZONE.ZONE_HEIGHT}`,
  };
}

/**
 * Get strike zone box positioning as percentage
 * Maps normalized coordinates to CSS percentages
 */
export function getZoneBoxStyle(): React.CSSProperties {
  // Convert normalized -1 to 1 range to 0-100% positioning
  const toPercent = (val: number) => ((val + 1) / 2) * 100;

  const left = toPercent(STRIKE_ZONE.ZONE_LEFT);
  const right = 100 - toPercent(STRIKE_ZONE.ZONE_RIGHT);
  const top = 100 - toPercent(STRIKE_ZONE.ZONE_TOP); // Invert Y
  const bottom = toPercent(STRIKE_ZONE.ZONE_BOTTOM) + 50; // Adjust for coordinate system

  return {
    left: `${left}%`,
    right: `${right}%`,
    top: `${top}%`,
    bottom: `${100 - toPercent(STRIKE_ZONE.ZONE_BOTTOM)}%`,
  };
}

// Grid configuration for better pitch proximity
export const GRID_CONFIG = {
  COLS: 12, // Increased from 5 for finer plotting grid
  ROWS: 16, // Proportional to aspect ratio (12 / 0.773 ≈ 15.5)
  HEATMAP_COLS: 14,
  HEATMAP_ROWS: 18,
} as const;

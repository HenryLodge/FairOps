/**
 * Venue bounds in lat/lng (same shape as GridOverlay.GridBounds).
 * Used to compute real-world dimensions for the AI layout optimizer.
 */
export interface VenueBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface VenueMetrics {
  widthMeters: number;
  heightMeters: number;
  areaM2: number;
}

/** Approximate meters per degree latitude at the equator */
const METERS_PER_DEGREE_LAT = 111_320;

/**
 * Compute real-world dimensions from lat/lng bounds.
 * Uses standard approximation: 1° lat ≈ 111.32 km; longitude scaled by cos(lat).
 * Returns null if bounds are missing or invalid (e.g. zero or negative span).
 */
export function boundsToMetrics(bounds: VenueBounds | null | undefined): VenueMetrics | null {
  if (!bounds) return null;
  const latDiff = bounds.north - bounds.south;
  const lngDiff = bounds.east - bounds.west;
  if (latDiff <= 0 || lngDiff <= 0) return null;
  const avgLat = (bounds.north + bounds.south) / 2;
  const heightMeters = latDiff * METERS_PER_DEGREE_LAT;
  const widthMeters = lngDiff * METERS_PER_DEGREE_LAT * Math.cos((avgLat * Math.PI) / 180);
  const areaM2 = widthMeters * heightMeters;
  return { widthMeters, heightMeters, areaM2 };
}

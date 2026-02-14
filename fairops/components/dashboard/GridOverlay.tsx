'use client';

import { useMemo } from 'react';
import { Polyline } from 'react-leaflet';
import L from 'leaflet';

export interface GridBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface GridOverlayProps {
  bounds: GridBounds;
  rows: number;
  cols: number;
}

const LINE_OPTIONS: L.PathOptions = {
  color: '#10b981',
  weight: 1,
  opacity: 0.6,
  dashArray: '4 4',
};

/**
 * Renders only the internal grid lines (no border rectangle, no corner markers).
 * The drawn shape itself serves as the boundary.
 */
export function GridOverlay({ bounds, rows, cols }: GridOverlayProps) {
  const lines = useMemo(() => {
    const result: L.LatLngExpression[][] = [];
    const latStep = (bounds.north - bounds.south) / rows;
    const lngStep = (bounds.east - bounds.west) / cols;

    // Horizontal lines
    for (let r = 1; r < rows; r++) {
      const lat = bounds.south + r * latStep;
      result.push([
        [lat, bounds.west],
        [lat, bounds.east],
      ]);
    }
    // Vertical lines
    for (let c = 1; c < cols; c++) {
      const lng = bounds.west + c * lngStep;
      result.push([
        [bounds.south, lng],
        [bounds.north, lng],
      ]);
    }
    return result;
  }, [bounds, rows, cols]);

  return (
    <>
      {lines.map((positions, i) => (
        <Polyline key={i} positions={positions} pathOptions={LINE_OPTIONS} />
      ))}
    </>
  );
}

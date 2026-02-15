import { createCanvas } from '@napi-rs/canvas';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/**
 * Minimal subset of DrawnShape used for rendering.
 * Mirrors the shape stored in the DB (same as VenueMap's DrawnShape).
 */
export interface DrawnShape {
  type: string; // "polygon" | "rectangle" | "circle" | "polyline"
  latlngs?: [number, number][] | [number, number][][];
  center?: [number, number];
  radius?: number;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const MAX_SIDE = 1024;
const PADDING = 48; // px padding around the drawing area
const BOUNDARY_COLOR = '#2563EB'; // blue-600
const BOUNDARY_WIDTH = 5;
const LABEL_FONT = 'bold 18px sans-serif';
const ORIENT_FONT = '14px sans-serif';
const GRID_COLOR = '#D1D5DB'; // gray-300
const GRID_DASH = [6, 6];

/** Approximate meters per degree latitude at the equator */
const METERS_PER_DEGREE_LAT = 111_320;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

interface BBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Flatten arbitrarily nested latlngs arrays into a flat list of [lat, lng] pairs.
 */
function flattenLatLngs(
  latlngs: [number, number][] | [number, number][][],
): [number, number][] {
  if (latlngs.length === 0) return [];
  // If the first element is itself an array of arrays, flatten one level
  if (Array.isArray(latlngs[0]) && Array.isArray((latlngs[0] as unknown[])[0])) {
    return (latlngs as [number, number][][]).flat();
  }
  return latlngs as [number, number][];
}

/**
 * Compute a global bounding box across all shapes.
 */
function computeBoundingBox(shapes: DrawnShape[]): BBox | null {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let found = false;

  for (const shape of shapes) {
    const type = shape.type?.toLowerCase();

    if ((type === 'rectangle' || type === 'polygon' || type === 'polyline') && shape.latlngs) {
      const pts = flattenLatLngs(shape.latlngs);
      for (const [lat, lng] of pts) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        found = true;
      }
    } else if (type === 'circle' && shape.center && typeof shape.radius === 'number') {
      // radius is in meters; convert to approximate degrees
      const [lat, lng] = shape.center;
      const dLat = shape.radius / METERS_PER_DEGREE_LAT;
      const dLng = shape.radius / (METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));
      if (lat - dLat < minLat) minLat = lat - dLat;
      if (lat + dLat > maxLat) maxLat = lat + dLat;
      if (lng - dLng < minLng) minLng = lng - dLng;
      if (lng + dLng > maxLng) maxLng = lng + dLng;
      found = true;
    }
  }

  if (!found) return null;
  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Convert [lat, lng] to canvas pixel coordinates.
 * Latitude is inverted (higher lat = further north = top of image = lower y).
 */
function toPixel(
  lat: number,
  lng: number,
  bbox: BBox,
  drawW: number,
  drawH: number,
): [number, number] {
  const latSpan = bbox.maxLat - bbox.minLat || 1e-9;
  const lngSpan = bbox.maxLng - bbox.minLng || 1e-9;
  const x = PADDING + ((lng - bbox.minLng) / lngSpan) * drawW;
  const y = PADDING + ((bbox.maxLat - lat) / latSpan) * drawH; // flip Y
  return [x, y];
}

/* ------------------------------------------------------------------ */
/* Main export                                                         */
/* ------------------------------------------------------------------ */

/**
 * Render the drawn shapes as a simple boundary outline PNG suitable for
 * sending to Gemini as a reference image.
 *
 * @returns base64-encoded PNG string (without data URI prefix), plus dimensions.
 *          Returns null if shapes are empty / cannot be rendered.
 */
export async function renderShapeBoundary(
  shapes: DrawnShape[],
  aspectRatio: { w: number; h: number },
): Promise<{ base64: string; width: number; height: number } | null> {
  if (!shapes || shapes.length === 0) return null;

  const bbox = computeBoundingBox(shapes);
  if (!bbox) return null;

  /* ---- Determine canvas dimensions from aspect ratio ---- */
  const arW = aspectRatio.w || 1;
  const arH = aspectRatio.h || 1;
  let canvasW: number;
  let canvasH: number;
  if (arW >= arH) {
    canvasW = MAX_SIDE;
    canvasH = Math.round(MAX_SIDE * (arH / arW));
  } else {
    canvasH = MAX_SIDE;
    canvasW = Math.round(MAX_SIDE * (arW / arH));
  }

  // Ensure minimum size
  canvasW = Math.max(canvasW, 256);
  canvasH = Math.max(canvasH, 256);

  const drawW = canvasW - PADDING * 2;
  const drawH = canvasH - PADDING * 2;

  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext('2d');

  /* ---- White background ---- */
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasW, canvasH);

  /* ---- Dashed grid ---- */
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.setLineDash(GRID_DASH);
  const gridLines = 8;
  for (let i = 1; i < gridLines; i++) {
    const xg = PADDING + (drawW / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(xg, PADDING);
    ctx.lineTo(xg, PADDING + drawH);
    ctx.stroke();

    const yg = PADDING + (drawH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(PADDING, yg);
    ctx.lineTo(PADDING + drawW, yg);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  /* ---- Orientation markers (N / S / E / W) ---- */
  ctx.fillStyle = '#6B7280'; // gray-500
  ctx.font = ORIENT_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('N', canvasW / 2, 4);
  ctx.textBaseline = 'bottom';
  ctx.fillText('S', canvasW / 2, canvasH - 4);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('W', 4, canvasH / 2);
  ctx.textAlign = 'right';
  ctx.fillText('E', canvasW - 4, canvasH / 2);

  /* ---- Draw each shape boundary ---- */
  ctx.strokeStyle = BOUNDARY_COLOR;
  ctx.lineWidth = BOUNDARY_WIDTH;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (const shape of shapes) {
    const type = shape.type?.toLowerCase();

    if (type === 'rectangle' && shape.latlngs) {
      const pts = flattenLatLngs(shape.latlngs);
      if (pts.length >= 2) {
        // Rectangle: two corners (SW, NE)
        const [lat1, lng1] = pts[0];
        const [lat2, lng2] = pts[1];
        const [x1, y1] = toPixel(lat1, lng1, bbox, drawW, drawH);
        const [x2, y2] = toPixel(lat2, lng2, bbox, drawW, drawH);
        const rx = Math.min(x1, x2);
        const ry = Math.min(y1, y2);
        const rw = Math.abs(x2 - x1);
        const rh = Math.abs(y2 - y1);
        ctx.strokeRect(rx, ry, rw, rh);
        // Light fill
        ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
        ctx.fillRect(rx, ry, rw, rh);
      }
    } else if (type === 'polygon' && shape.latlngs) {
      const pts = flattenLatLngs(shape.latlngs);
      if (pts.length >= 3) {
        ctx.beginPath();
        const [startX, startY] = toPixel(pts[0][0], pts[0][1], bbox, drawW, drawH);
        ctx.moveTo(startX, startY);
        for (let i = 1; i < pts.length; i++) {
          const [px, py] = toPixel(pts[i][0], pts[i][1], bbox, drawW, drawH);
          ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        // Light fill
        ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
        ctx.fill();
      }
    } else if (type === 'circle' && shape.center && typeof shape.radius === 'number') {
      const [clat, clng] = shape.center;
      const [cx, cy] = toPixel(clat, clng, bbox, drawW, drawH);
      // Compute pixel radius by comparing center to a point `radius` meters north
      const northLat = clat + shape.radius / METERS_PER_DEGREE_LAT;
      const [, ny] = toPixel(northLat, clng, bbox, drawW, drawH);
      const pixelRadius = Math.abs(cy - ny);
      ctx.beginPath();
      ctx.arc(cx, cy, pixelRadius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.stroke();
      // Light fill
      ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
      ctx.fill();
    } else if (type === 'polyline' && shape.latlngs) {
      const pts = flattenLatLngs(shape.latlngs);
      if (pts.length >= 2) {
        ctx.beginPath();
        const [startX, startY] = toPixel(pts[0][0], pts[0][1], bbox, drawW, drawH);
        ctx.moveTo(startX, startY);
        for (let i = 1; i < pts.length; i++) {
          const [px, py] = toPixel(pts[i][0], pts[i][1], bbox, drawW, drawH);
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
  }

  /* ---- Label ---- */
  ctx.fillStyle = BOUNDARY_COLOR;
  ctx.font = LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(
    'VENUE BOUNDARY — place all items inside this shape',
    canvasW / 2,
    PADDING + drawH + 8,
  );

  /* ---- Export ---- */
  const buffer = canvas.toBuffer('image/png');
  const base64 = buffer.toString('base64');

  return { base64, width: canvasW, height: canvasH };
}

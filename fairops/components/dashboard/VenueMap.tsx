'use client';

import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  FeatureGroup,
  LayersControl,
  useMap,
} from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import { GridOverlay, type GridBounds } from './GridOverlay';
import { geocodeLocation } from '../../lib/geocode';
import {
  Minus,
  Plus,
  Save,
  Loader2,
  Grid3x3,
  EyeOff,
  Eye,
  Search,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Fix Leaflet's default icon paths (broken by bundlers)               */
/* ------------------------------------------------------------------ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** GeoJSON-like shape stored in the DB */
export interface DrawnShape {
  type: string; // e.g. "polygon", "rectangle", "circle", "marker", "polyline"
  latlngs?: [number, number][] | [number, number][][];
  center?: [number, number];
  radius?: number;
}

export interface VenueEvent {
  id: string;
  location: string;
  venue_width: number | null;
  venue_height: number | null;
  venue_lat: number | null;
  venue_lng: number | null;
  venue_bounds: GridBounds | null;
}

interface VenueMapProps {
  event: VenueEvent;
  venueWidth: number;
  venueHeight: number;
  onSave: (data: {
    venue_width: number;
    venue_height: number;
    venue_lat: number;
    venue_lng: number;
    venue_bounds: GridBounds;
    drawn_shapes?: DrawnShape[];
  }) => Promise<void>;
}

const MIN_DIM = 2;
const MAX_DIM = 20;

/** Compute the bounding box from a list of Leaflet layers. */
function boundsFromLayers(layers: L.Layer[]): GridBounds | null {
  if (layers.length === 0) return null;
  const group = L.featureGroup(layers);
  const b = group.getBounds();
  if (!b.isValid()) return null;
  const sw = b.getSouthWest();
  const ne = b.getNorthEast();
  return {
    north: ne.lat,
    south: sw.lat,
    east: ne.lng,
    west: sw.lng,
  };
}

/* ------------------------------------------------------------------ */
/* Tile layer URLs                                                     */
/* ------------------------------------------------------------------ */
const STREET_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const STREET_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const SATELLITE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_ATTR =
  'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics';

/* ------------------------------------------------------------------ */
/* Helper: extract shape data from a Leaflet layer                     */
/* ------------------------------------------------------------------ */
function layerToShape(layer: L.Layer): DrawnShape | null {
  if (layer instanceof L.Circle) {
    const c = layer.getLatLng();
    return {
      type: 'circle',
      center: [c.lat, c.lng],
      radius: layer.getRadius(),
    };
  }
  if (layer instanceof L.Marker) {
    const p = layer.getLatLng();
    return { type: 'marker', center: [p.lat, p.lng] };
  }
  if (layer instanceof L.Rectangle) {
    const b = layer.getBounds();
    return {
      type: 'rectangle',
      latlngs: [
        [b.getSouthWest().lat, b.getSouthWest().lng],
        [b.getNorthEast().lat, b.getNorthEast().lng],
      ],
    };
  }
  if (layer instanceof L.Polygon) {
    // getLatLngs returns LatLng[][] for polygons
    const raw = layer.getLatLngs() as L.LatLng[][];
    const latlngs = (raw[0] ?? raw).map((ll: L.LatLng) => [ll.lat, ll.lng] as [number, number]);
    return { type: 'polygon', latlngs };
  }
  if (layer instanceof L.Polyline) {
    const raw = layer.getLatLngs() as L.LatLng[];
    const latlngs = raw.map((ll) => [ll.lat, ll.lng] as [number, number]);
    return { type: 'polyline', latlngs };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* FlyTo helper — flies to new center when it changes                  */
/* ------------------------------------------------------------------ */
function FlyTo({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 17, { duration: 1.2 });
  }, [map, center]);
  return null;
}

/* ------------------------------------------------------------------ */
/* Search bar rendered on top of the map                               */
/* ------------------------------------------------------------------ */
function MapSearchBar({
  onResult,
}: {
  onResult: (lat: number, lng: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim()) return;
      setSearching(true);
      try {
        const result = await geocodeLocation(query.trim());
        if (result) {
          onResult(result.lat, result.lng);
        }
      } finally {
        setSearching(false);
      }
    },
    [query, onResult]
  );

  return (
    <form
      onSubmit={handleSearch}
      className="absolute left-12 top-2.5 z-[1000] flex w-72 overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-md dark:border-zinc-600 dark:bg-zinc-800"
    >
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search location..."
        className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
      />
      <button
        type="submit"
        disabled={searching}
        className="flex w-9 shrink-0 items-center justify-center border-l border-zinc-300 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
        aria-label="Search"
      >
        {searching ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
export default function VenueMap({
  event,
  venueWidth,
  venueHeight,
  onSave,
}: VenueMapProps) {
  const [center, setCenter] = useState<[number, number] | null>(
    event.venue_lat != null && event.venue_lng != null
      ? [event.venue_lat, event.venue_lng]
      : null
  );
  const [bounds, setBounds] = useState<GridBounds | null>(
    event.venue_bounds ?? null
  );
  const [rows, setRows] = useState(
    Math.min(MAX_DIM, Math.max(MIN_DIM, venueHeight))
  );
  const [cols, setCols] = useState(
    Math.min(MAX_DIM, Math.max(MIN_DIM, venueWidth))
  );
  const [showGrid, setShowGrid] = useState(false);
  const [noShapesHint, setNoShapesHint] = useState(false);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const geocoded = useRef(false);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  /** Explicitly track every drawn layer so we can reliably compute bounds */
  const drawnLayersRef = useRef<Map<number, L.Layer>>(new Map());

  /* Geocode on first mount if we don't have coordinates */
  useEffect(() => {
    if (center || geocoded.current) return;
    geocoded.current = true;
    setGeocoding(true);
    geocodeLocation(event.location).then((result) => {
      setGeocoding(false);
      if (result) {
        setCenter([result.lat, result.lng]);
      } else {
        setCenter([39.8283, -98.5795]);
      }
    });
  }, [center, event.location]);

  const adjustRows = useCallback((delta: number) => {
    setRows((r) => Math.min(MAX_DIM, Math.max(MIN_DIM, r + delta)));
    setSaved(false);
  }, []);

  const adjustCols = useCallback((delta: number) => {
    setCols((c) => Math.min(MAX_DIM, Math.max(MIN_DIM, c + delta)));
    setSaved(false);
  }, []);

  /** Collect all drawn shapes from our tracked layers */
  const collectShapes = useCallback((): DrawnShape[] => {
    const shapes: DrawnShape[] = [];
    drawnLayersRef.current.forEach((layer) => {
      const shape = layerToShape(layer);
      if (shape) shapes.push(shape);
    });
    return shapes;
  }, []);

  const handleSave = useCallback(async () => {
    if (!center) return;
    /* If the grid is shown we save its bounds; otherwise derive from shapes */
    const saveBounds =
      bounds ?? boundsFromLayers(Array.from(drawnLayersRef.current.values()));
    if (!saveBounds) return;
    setSaving(true);
    try {
      await onSave({
        venue_width: cols,
        venue_height: rows,
        venue_lat: center[0],
        venue_lng: center[1],
        venue_bounds: saveBounds,
        drawn_shapes: collectShapes(),
      });
      setSaved(true);
    } catch {
      // parent handles error
    } finally {
      setSaving(false);
    }
  }, [center, bounds, cols, rows, onSave, collectShapes]);

  const handleSearchResult = useCallback(
    (lat: number, lng: number) => {
      setCenter([lat, lng]);
      setFlyTarget([lat, lng]);
      setSaved(false);
    },
    []
  );

  /* Draw event handlers — track layers explicitly */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onCreated = useCallback((e: any) => {
    const layer = e.layer as L.Layer;
    const id = L.Util.stamp(layer);
    drawnLayersRef.current.set(id, layer);
    setSaved(false);
  }, []);

  const onEdited = useCallback(() => {
    /* Layers are mutated in place; just mark unsaved */
    setSaved(false);
    /* Recompute grid bounds if the grid is visible */
    if (showGrid) {
      const computed = boundsFromLayers(
        Array.from(drawnLayersRef.current.values())
      );
      if (computed) setBounds(computed);
    }
  }, [showGrid]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onDeleted = useCallback((e: any) => {
    const layers = e.layers as L.LayerGroup;
    layers.eachLayer((layer) => {
      const id = L.Util.stamp(layer);
      drawnLayersRef.current.delete(id);
    });
    setSaved(false);
    /* If no shapes remain, hide the grid */
    if (drawnLayersRef.current.size === 0) {
      setShowGrid(false);
      setBounds(null);
    } else if (showGrid) {
      const computed = boundsFromLayers(
        Array.from(drawnLayersRef.current.values())
      );
      if (computed) setBounds(computed);
    }
  }, [showGrid]);

  /* ------ Loading state ------ */
  if (geocoding || !center) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center bg-zinc-100 dark:bg-zinc-900">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Locating venue...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[400px]">
      {/* Map */}
      <div className="absolute inset-0 bottom-10">
        {/* Search bar floating on top of map */}
        <MapSearchBar onResult={handleSearchResult} />

        <MapContainer
          center={center}
          zoom={17}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
        >
          {/* Fly to new location when search result comes in */}
          {flyTarget && <FlyTo center={flyTarget} />}

          {/* Layer switcher: Street vs Satellite */}
          <LayersControl position="topright">
            <LayersControl.BaseLayer name="Street" checked>
              <TileLayer attribution={STREET_ATTR} url={STREET_URL} />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellite">
              <TileLayer
                attribution={SATELLITE_ATTR}
                url={SATELLITE_URL}
                maxZoom={19}
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          {/* Drawn shapes (polygons, rectangles, markers, etc.) */}
          <FeatureGroup
            ref={(fg) => {
              drawnItemsRef.current = fg ?? null;
            }}
          >
            <EditControl
              position="topleft"
              onCreated={onCreated}
              onEdited={onEdited}
              onDeleted={onDeleted}
              draw={{
                polygon: {
                  shapeOptions: {
                    color: '#6366f1',
                    weight: 2,
                    fillOpacity: 0.15,
                  },
                },
                rectangle: {
                  shapeOptions: {
                    color: '#6366f1',
                    weight: 2,
                    fillOpacity: 0.15,
                  },
                },
                polyline: {
                  shapeOptions: {
                    color: '#f59e0b',
                    weight: 2,
                  },
                },
                circle: {
                  shapeOptions: {
                    color: '#6366f1',
                    weight: 2,
                    fillOpacity: 0.15,
                  },
                },
                marker: true,
                circlemarker: false,
              }}
            />
          </FeatureGroup>

          {/* Grid overlay (togglable) — only grid lines, no border */}
          {showGrid && bounds && (
            <GridOverlay bounds={bounds} rows={rows} cols={cols} />
          )}
        </MapContainer>
      </div>

      {/* Toolbar */}
      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-3 border-t border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
        {/* Grid toggle */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              if (showGrid) {
                /* Toggling OFF — just hide */
                setShowGrid(false);
                return;
              }
              /* Toggling ON — compute bounds from tracked drawn layers */
              const layers = Array.from(drawnLayersRef.current.values());
              const computed = boundsFromLayers(layers);
              if (!computed) {
                /* No shapes drawn yet — flash a hint */
                setNoShapesHint(true);
                setTimeout(() => setNoShapesHint(false), 2500);
                return;
              }
              setBounds(computed);
              setShowGrid(true);
              setSaved(false);
            }}
            className={`flex h-7 items-center gap-1 rounded px-2 text-xs font-medium ${
              showGrid
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
            }`}
            aria-label={showGrid ? 'Hide grid' : 'Show grid'}
          >
            {showGrid ? (
              <Eye className="h-3 w-3" />
            ) : (
              <EyeOff className="h-3 w-3" />
            )}
            <Grid3x3 className="h-3 w-3" />
          </button>
          {noShapesHint && (
            <span className="absolute -top-8 left-0 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-[11px] text-white shadow dark:bg-zinc-200 dark:text-zinc-900">
              Draw a shape first
            </span>
          )}
        </div>

        {/* Columns control */}
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Cols
          </span>
          <button
            type="button"
            onClick={() => adjustCols(-1)}
            disabled={cols <= MIN_DIM}
            className="flex h-7 w-7 items-center justify-center rounded bg-zinc-100 text-zinc-600 hover:bg-zinc-200 disabled:opacity-40 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            aria-label="Remove column"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="min-w-[1.5rem] text-center text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {cols}
          </span>
          <button
            type="button"
            onClick={() => adjustCols(1)}
            disabled={cols >= MAX_DIM}
            className="flex h-7 w-7 items-center justify-center rounded bg-zinc-100 text-zinc-600 hover:bg-zinc-200 disabled:opacity-40 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            aria-label="Add column"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {/* Rows control */}
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Rows
          </span>
          <button
            type="button"
            onClick={() => adjustRows(-1)}
            disabled={rows <= MIN_DIM}
            className="flex h-7 w-7 items-center justify-center rounded bg-zinc-100 text-zinc-600 hover:bg-zinc-200 disabled:opacity-40 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            aria-label="Remove row"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="min-w-[1.5rem] text-center text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {rows}
          </span>
          <button
            type="button"
            onClick={() => adjustRows(1)}
            disabled={rows >= MAX_DIM}
            className="flex h-7 w-7 items-center justify-center rounded bg-zinc-100 text-zinc-600 hover:bg-zinc-200 disabled:opacity-40 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            aria-label="Add row"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        <div className="flex-1" />

        {/* Grid size display */}
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {cols} &times; {rows} grid
        </span>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          {saved ? 'Saved' : saving ? 'Saving...' : 'Save grid'}
        </button>
      </div>
    </div>
  );
}

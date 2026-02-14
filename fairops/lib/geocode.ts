const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

/**
 * Geocode a location string (e.g. "Riverside Fairgrounds, CA") to lat/lng
 * using the free OpenStreetMap Nominatim API (no API key required).
 *
 * Nominatim usage policy requires a descriptive User-Agent header.
 * Rate limit: max 1 request per second.
 */
export async function geocodeLocation(
  query: string
): Promise<{ lat: number; lng: number } | null> {
  if (!query.trim()) return null;

  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "1",
  });

  try {
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { "User-Agent": "FairOps/1.0 (hackathon project)" },
    });

    if (!res.ok) {
      console.error("[geocode] Nominatim returned", res.status);
      return null;
    }

    const data = (await res.json()) as Array<{ lat: string; lon: string }>;

    if (!data.length) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  } catch (err) {
    console.error("[geocode] Failed to geocode:", err);
    return null;
  }
}

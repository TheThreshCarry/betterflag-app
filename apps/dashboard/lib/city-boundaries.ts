/**
 * Resolve OSM city boundaries via Nominatim (polygon_geojson).
 * In-memory cache + ~1 req/s to respect Nominatim usage policy.
 */

export type CityBoundaryGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

type NominatimResult = {
  name?: string;
  type?: string;
  class?: string;
  place_rank?: number;
  importance?: number;
  geojson?: GeoJSON.Geometry;
};

const cache = new Map<string, CityBoundaryGeometry | null>();
const queue: Array<() => void> = [];
let pumping = false;
const MIN_INTERVAL_MS = 1100;

function cacheKey(country: string, city: string): string {
  return `${country.toUpperCase()}:city:${city.trim().toLowerCase()}`;
}

function isPolygonGeometry(g: GeoJSON.Geometry | undefined): g is CityBoundaryGeometry {
  return g?.type === "Polygon" || g?.type === "MultiPolygon";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pumpQueue(): Promise<void> {
  if (pumping) return;
  pumping = true;
  while (queue.length > 0) {
    const next = queue.shift();
    next?.();
    if (queue.length > 0) await sleep(MIN_INTERVAL_MS);
  }
  pumping = false;
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push(() => {
      void fn().then(resolve, reject);
    });
    void pumpQueue();
  });
}

function scoreCityResult(r: NominatimResult): number {
  let s = r.importance ?? 0;
  if (r.class === "boundary" || r.class === "place") s += 2;
  if (r.type === "city" || r.type === "town" || r.type === "municipality") s += 3;
  if (r.type === "administrative") s += 1;
  if (isPolygonGeometry(r.geojson)) s += 4;
  // Prefer city ranks (~13–16) over state (~8).
  const rank = r.place_rank ?? 20;
  if (rank >= 12 && rank <= 16) s += 3;
  else if (rank <= 10) s -= 2;
  return s;
}

async function nominatimCityBoundary(
  country: string,
  city: string,
): Promise<CityBoundaryGeometry | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("city", city);
  url.searchParams.set("countrycodes", country.toLowerCase());
  url.searchParams.set("format", "json");
  url.searchParams.set("polygon_geojson", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "0");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "ShipOS-Dashboard/1.0 (analytics; https://shipos.app)",
    },
    next: { revalidate: 60 * 60 * 24 * 30 },
  });
  if (!res.ok) return null;

  const results = (await res.json()) as NominatimResult[];
  if (!Array.isArray(results) || results.length === 0) return null;

  const ranked = [...results].sort((a, b) => scoreCityResult(b) - scoreCityResult(a));
  for (const row of ranked) {
    if (isPolygonGeometry(row.geojson)) return row.geojson;
  }
  return null;
}

export async function resolveCityBoundary(
  country: string,
  city: string,
): Promise<CityBoundaryGeometry | null> {
  const key = cacheKey(country, city);
  if (cache.has(key)) return cache.get(key) ?? null;

  const geometry = await enqueue(() => nominatimCityBoundary(country, city));
  cache.set(key, geometry);
  return geometry;
}

export type CityBoundaryHit = {
  city: string;
  geometry: CityBoundaryGeometry;
};

export async function resolveCityBoundaries(
  country: string,
  cities: readonly string[],
  limit = 40,
): Promise<CityBoundaryHit[]> {
  const unique = [...new Set(cities.map((c) => c.trim()).filter(Boolean))].slice(0, limit);
  const hits: CityBoundaryHit[] = [];
  for (const city of unique) {
    const geometry = await resolveCityBoundary(country, city);
    if (geometry) hits.push({ city, geometry });
  }
  return hits;
}

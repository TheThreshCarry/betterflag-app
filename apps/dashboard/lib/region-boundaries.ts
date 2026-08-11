/**
 * Resolve OSM region/state boundaries via Nominatim (polygon_geojson).
 * In-memory cache + ~1 req/s to respect Nominatim usage policy.
 */

export type RegionBoundaryGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

type NominatimResult = {
  name?: string;
  type?: string;
  class?: string;
  place_rank?: number;
  importance?: number;
  geojson?: GeoJSON.Geometry;
};

const cache = new Map<string, RegionBoundaryGeometry | null>();
const queue: Array<() => void> = [];
let pumping = false;
const MIN_INTERVAL_MS = 1100;

function cacheKey(country: string, region: string): string {
  return `${country.toUpperCase()}:${region.trim().toLowerCase()}`;
}

function isPolygonGeometry(g: GeoJSON.Geometry | undefined): g is RegionBoundaryGeometry {
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

function scoreRegionResult(r: NominatimResult): number {
  let s = r.importance ?? 0;
  if (r.class === "boundary") s += 3;
  if (r.type === "administrative") s += 2;
  if (isPolygonGeometry(r.geojson)) s += 4;
  // Prefer state/region ranks (~8) over city (~16).
  const rank = r.place_rank ?? 20;
  if (rank <= 10) s += 4;
  else if (rank <= 12) s += 2;
  else if (rank >= 14) s -= 2;
  return s;
}

async function nominatimRegionBoundary(
  country: string,
  region: string,
): Promise<RegionBoundaryGeometry | null> {
  // Prefer structured state search (e.g. Madrid → Comunidad de Madrid).
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("state", region);
  url.searchParams.set("countrycodes", country.toLowerCase());
  url.searchParams.set("format", "json");
  url.searchParams.set("polygon_geojson", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "0");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "Betterflag-Dashboard/1.0 (analytics; https://betterflag.app)",
    },
    next: { revalidate: 60 * 60 * 24 * 30 },
  });
  if (!res.ok) return null;

  const results = (await res.json()) as NominatimResult[];
  if (!Array.isArray(results) || results.length === 0) return null;

  const ranked = [...results].sort((a, b) => scoreRegionResult(b) - scoreRegionResult(a));
  for (const row of ranked) {
    if (isPolygonGeometry(row.geojson)) return row.geojson;
  }
  return null;
}

/** Cached boundary lookup for one region/state. */
export async function resolveRegionBoundary(
  country: string,
  region: string,
): Promise<RegionBoundaryGeometry | null> {
  const key = cacheKey(country, region);
  if (cache.has(key)) return cache.get(key) ?? null;

  const geometry = await enqueue(() => nominatimRegionBoundary(country, region));
  cache.set(key, geometry);
  return geometry;
}

export type RegionBoundaryHit = {
  region: string;
  geometry: RegionBoundaryGeometry;
};

/**
 * Resolve boundaries for many regions in one country (sequential, cached).
 */
export async function resolveRegionBoundaries(
  country: string,
  regions: readonly string[],
  limit = 40,
): Promise<RegionBoundaryHit[]> {
  const unique = [...new Set(regions.map((r) => r.trim()).filter(Boolean))].slice(0, limit);
  const hits: RegionBoundaryHit[] = [];
  for (const region of unique) {
    const geometry = await resolveRegionBoundary(country, region);
    if (geometry) hits.push({ region, geometry });
  }
  return hits;
}

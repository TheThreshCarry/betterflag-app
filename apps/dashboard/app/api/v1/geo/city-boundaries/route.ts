/**
 * GET /api/v1/geo/city-boundaries?country=ES&cities=Madrid,Toledo
 * Returns OSM city polygons (Nominatim), as GeoJSON features.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { resolveActor } from "@/lib/auth";
import { resolveCityBoundaries } from "@/lib/city-boundaries";
import { parseQuery, withErrors } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

const querySchema = z.object({
  country: z
    .string()
    .regex(/^[A-Z]{2}$/, "country must be an ISO 3166-1 alpha-2 code"),
  cities: z
    .string()
    .min(1)
    .transform((raw) =>
      raw
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().min(1)).min(1).max(40)),
});

export const GET = withErrors(async (request: NextRequest) => {
  await resolveActor(request);
  const query = parseQuery(request, querySchema);

  const hits = await resolveCityBoundaries(query.country, query.cities);
  const features: GeoJSON.Feature<
    GeoJSON.Polygon | GeoJSON.MultiPolygon,
    { city: string }
  >[] = hits.map((hit) => ({
    type: "Feature",
    id: hit.city,
    properties: { city: hit.city },
    geometry: hit.geometry,
  }));

  return NextResponse.json({
    type: "FeatureCollection",
    features,
  } satisfies GeoJSON.FeatureCollection);
});

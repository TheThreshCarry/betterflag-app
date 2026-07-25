/**
 * GET /api/v1/geo/region-boundaries?country=ES&regions=Madrid,Catalonia
 * Returns OSM state/region polygons (Nominatim), as GeoJSON features.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { resolveActor } from "@/lib/auth";
import { resolveRegionBoundaries } from "@/lib/region-boundaries";
import { parseQuery, withErrors } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

const querySchema = z.object({
  country: z
    .string()
    .regex(/^[A-Z]{2}$/, "country must be an ISO 3166-1 alpha-2 code"),
  regions: z
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

  const hits = await resolveRegionBoundaries(query.country, query.regions);
  const features: GeoJSON.Feature<
    GeoJSON.Polygon | GeoJSON.MultiPolygon,
    { region: string }
  >[] = hits.map((hit) => ({
    type: "Feature",
    id: hit.region,
    properties: { region: hit.region },
    geometry: hit.geometry,
  }));

  return NextResponse.json({
    type: "FeatureCollection",
    features,
  } satisfies GeoJSON.FeatureCollection);
});

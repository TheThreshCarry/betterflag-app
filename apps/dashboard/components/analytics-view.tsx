"use client";

import { CountryFlagRounded } from "@appica/country-flags-react";
import { useTheme } from "@appica/ui-react/hooks/use-theme";
import { ANALYTICS_RETENTION_DAYS } from "@shipos/db";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useApp } from "@/components/app-shell";
import { Card, Chip, EmptyState, ErrorNote } from "@/components/ui";
import {
  Map as MapView,
  MapControls,
  MapGeoJSON,
  MapMarker,
  MapPopup,
  MarkerContent,
  MarkerLabel,
  type MapRef,
} from "@/components/ui/map";
import { Skeleton } from "@/components/ui/skeleton";
import { Stagger } from "@/components/stagger";
import type { AnalyticsPeriod, ApiAnalytics, CountryPoint } from "@/lib/api-types";
import { api } from "@/lib/client-api";
import { countryCentroid } from "@/lib/country-centroids";
import { staggerStyle } from "@/lib/stagger";
import { cn } from "@/lib/utils";

const PERIODS: { value: AnalyticsPeriod; label: string; days: number }[] = [
  { value: "24h", label: "24 hours", days: 1 },
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "90d", label: "90 days", days: 90 },
];

const WORLD_CENTER: [number, number] = [10, 20];
const WORLD_ZOOM = 1.35;
const WORLD_COUNTRIES_URL = "/world-countries.json";

type WorldCountryProps = {
  iso: string;
  name: string;
  evaluations: number;
  /** 0–1, min–max normalized across countries with traffic. */
  intensity: number;
};

type WorldCountryFeature = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  WorldCountryProps
>;

type WorldCountries = GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  { iso: string; name: string }
>;

type LngLatBoundsTuple = [[number, number], [number, number]];

function ringBounds(ring: GeoJSON.Position[]): LngLatBoundsTuple {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const pos of ring) {
    const lng = pos[0];
    const lat = pos[1];
    if (lng == null || lat == null) continue;
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

/** Prefer the largest polygon (mainland) so overseas territories don't yank the camera. */
function countryBounds(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
): LngLatBoundsTuple | null {
  if (geometry.type === "Polygon") {
    const ring = geometry.coordinates[0];
    return ring ? ringBounds(ring) : null;
  }
  let best: LngLatBoundsTuple | null = null;
  let bestArea = -1;
  for (const polygon of geometry.coordinates) {
    const ring = polygon[0];
    if (!ring) continue;
    const bounds = ringBounds(ring);
    const area =
      (bounds[1][0] - bounds[0][0]) * (bounds[1][1] - bounds[0][1]);
    if (area > bestArea) {
      bestArea = area;
      best = bounds;
    }
  }
  return best;
}

export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
  return value.toLocaleString();
}

const regionNames =
  typeof Intl !== "undefined" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;

export function countryName(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "Unknown";
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

function CountryLabel({ code }: { code: string }) {
  const name = countryName(code);
  const valid = /^[A-Z]{2}$/.test(code);

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {valid ? (
        <CountryFlagRounded
          code={code.toLowerCase()}
          size={16}
          title={name}
          className="shrink-0"
        />
      ) : (
        <span
          className="flex size-4 shrink-0 items-center justify-center rounded-[3px] bg-line text-[9px] font-medium text-ink-muted"
          aria-hidden
        >
          ?
        </span>
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}

function FilterButton({
  active,
  disabled,
  title,
  onClick,
  className,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        "h-8 rounded-lg border px-3 text-[13px] font-medium transition-colors",
        active
          ? "border-ink bg-ink text-canvas"
          : disabled
            ? "cursor-not-allowed border-line text-ink-muted/50"
            : "border-line bg-canvas text-ink hover:bg-surface",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function AnalyticsView() {
  const { org, activeProject, environments } = useApp();
  const [period, setPeriod] = useState<AnalyticsPeriod>("7d");
  const [envFilter, setEnvFilter] = useState<string>("all");
  const [data, setData] = useState<ApiAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [countryDetail, setCountryDetail] = useState<ApiAnalytics | null>(null);
  const [countryLoading, setCountryLoading] = useState(false);
  const [countryError, setCountryError] = useState<string | null>(null);

  const retentionDays = ANALYTICS_RETENTION_DAYS[org.plan];

  useEffect(() => {
    if (!activeProject) return;
    let cancelled = false;
    setData(null);
    setError(null);
    setSelectedCountry(null);
    const query = new URLSearchParams({ period, projectId: activeProject.id });
    if (envFilter !== "all") query.set("env", envFilter);
    void api<ApiAnalytics>(`/api/v1/analytics?${query.toString()}`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load analytics");
      });
    return () => {
      cancelled = true;
    };
  }, [activeProject, period, envFilter]);

  useEffect(() => {
    if (!activeProject || !selectedCountry) {
      setCountryDetail(null);
      setCountryError(null);
      setCountryLoading(false);
      return;
    }
    let cancelled = false;
    setCountryLoading(true);
    setCountryDetail(null);
    setCountryError(null);
    const query = new URLSearchParams({
      period,
      projectId: activeProject.id,
      country: selectedCountry,
    });
    if (envFilter !== "all") query.set("env", envFilter);
    void api<ApiAnalytics>(`/api/v1/analytics?${query.toString()}`)
      .then((result) => {
        if (!cancelled) {
          setCountryDetail(result);
          setCountryLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCountryError(
            err instanceof Error ? err.message : "Failed to load country analytics",
          );
          setCountryLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeProject, period, envFilter, selectedCountry]);

  if (!activeProject) {
    return (
      <EmptyState
        title="No project selected"
        body="Create or select a project to see its evaluation analytics."
      />
    );
  }

  return (
    <Stagger>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Analytics</h1>
          <p className="mt-0.5 text-[14px] text-ink-muted">
            Where evaluations land, and which flags drive them.
          </p>
        </div>
        <Chip color="gray">{retentionDays}-day retention</Chip>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5" role="group" aria-label="Timeframe">
          {PERIODS.map(({ value, label, days }) => {
            const beyondRetention = days > retentionDays;
            return (
              <FilterButton
                key={value}
                active={period === value}
                disabled={beyondRetention}
                title={
                  beyondRetention
                    ? `Beyond your plan's ${retentionDays}-day analytics retention`
                    : undefined
                }
                onClick={() => setPeriod(value)}
              >
                {label}
              </FilterButton>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="Environment">
          {["all", ...environments.map((env) => env.slug)].map((slug) => (
            <FilterButton
              key={slug}
              active={envFilter === slug}
              onClick={() => setEnvFilter(slug)}
              className="font-mono text-[12px]"
            >
              {slug === "all" ? "all envs" : slug}
            </FilterButton>
          ))}
        </div>
      </div>

      {error ? <ErrorNote message={error} /> : null}
      {!error && !data ? (
        <div className="min-h-[520px]">
          <AnalyticsSkeleton />
        </div>
      ) : null}
      {!error && data ? (
        <AnalyticsContent
          data={data}
          selectedCountry={selectedCountry}
          onSelectCountry={setSelectedCountry}
          countryDetail={countryDetail}
          countryLoading={countryLoading}
          countryError={countryError}
          staggerSelf
          className="min-h-[520px]"
        />
      ) : null}
    </Stagger>
  );
}

function AnalyticsContent({
  data,
  selectedCountry,
  onSelectCountry,
  countryDetail,
  countryLoading,
  countryError,
  staggerFrom = 0,
  staggerSelf: _staggerSelf,
  className,
}: {
  data: ApiAnalytics;
  selectedCountry: string | null;
  onSelectCountry: (code: string | null) => void;
  countryDetail: ApiAnalytics | null;
  countryLoading: boolean;
  countryError: string | null;
  staggerFrom?: number;
  staggerSelf?: boolean;
  className?: string;
}) {
  // Charts keep global numbers; country selection only zooms the map + sidebar detail.
  if (data.total === 0) {
    return (
      <div className={cn("stagger-in", className)} style={staggerStyle(staggerFrom)}>
        <EmptyState
          title="No evaluations in this period"
          body="Once your SDKs or agents evaluate flags, country and flag breakdowns show up here."
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/*
        Map must NOT sit under stagger-in (opacity/filter/transform). Those
        break MapLibre WebGL init and leave the canvas blank with a stuck loader.
      */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="relative h-[420px] overflow-hidden rounded-3xl border border-line bg-surface">
          <EvaluationsMap
            countries={data.countries}
            total={data.total}
            period={data.period}
            selectedCountry={selectedCountry}
            onSelectCountry={onSelectCountry}
            countryDetail={countryDetail}
            countryLoading={countryLoading}
          />
        </div>
        <div className="stagger-in xl:h-[420px]" style={staggerStyle(staggerFrom)}>
          <Card className="flex h-full flex-col p-5">
            {selectedCountry ? (
              <CountryDetailPanel
                country={selectedCountry}
                detail={countryDetail}
                loading={countryLoading}
                error={countryError}
                period={data.period}
                onClear={() => onSelectCountry(null)}
              />
            ) : (
              <>
                <p className="text-[12px] font-medium tracking-wide text-ink-muted uppercase">
                  Evaluations
                </p>
                <p className="mt-1 font-mono text-[36px] font-semibold tracking-tight">
                  {formatCount(data.total)}
                </p>
                <p className="text-[13px] text-ink-muted">in the last {data.period}</p>
                <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
                  <h2 className="text-[14px] font-semibold">By country</h2>
                  <span className="text-[12px] text-ink-muted">{data.countries.length}</span>
                </div>
                <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                  <CountryTable
                    countries={data.countries}
                    total={data.total}
                    selectedCountry={selectedCountry}
                    onSelectCountry={onSelectCountry}
                    compact
                  />
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      <Stagger from={staggerFrom + 1} className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-[16px] font-semibold">Over time</h2>
              <span className="text-[12px] text-ink-muted">
                {data.period === "24h" ? "hourly" : "daily"}
              </span>
            </div>
            <SeriesChart series={data.series} hourly={data.period === "24h"} />
          </Card>
          <Card className="p-6">
            <h2 className="mb-4 text-[16px] font-semibold">Environments</h2>
            {data.environments.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-ink-muted">No env breakdown yet.</p>
            ) : (
              <div className="space-y-3">
                {data.environments.map((row) => {
                  const pct = data.total > 0 ? (row.evaluations / data.total) * 100 : 0;
                  return (
                    <div key={row.env}>
                      <div className="mb-1.5 flex items-center justify-between text-[13px]">
                        <span className="font-mono text-[12px]">{row.env}</span>
                        <span className="font-mono text-[12px] text-ink-muted">
                          {formatCount(row.evaluations)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-line/60">
                        <div
                          className="h-full rounded-full bg-[#0067F4]/85"
                          style={{ width: `${Math.max(pct, 1)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <Card className="p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-[16px] font-semibold">Top flags</h2>
            <span className="text-[12px] text-ink-muted">by evaluations</span>
          </div>
          <RankedBars
            rows={data.flags.map((row) => ({
              key: row.flagKey,
              label: row.flagKey,
              mono: true,
              evaluations: row.evaluations,
            }))}
            total={data.total}
          />
        </Card>
      </Stagger>
    </div>
  );
}

function CountryDetailPanel({
  country,
  detail,
  loading,
  error,
  period,
  onClear,
}: {
  country: string;
  detail: ApiAnalytics | null;
  loading: boolean;
  error: string | null;
  period: AnalyticsPeriod;
  onClear: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12px] font-medium tracking-wide text-ink-muted uppercase">
            Country
          </p>
          <div className="mt-1 text-[16px] font-semibold">
            <CountryLabel code={country} />
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[12px] font-medium text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
        >
          All countries
        </button>
      </div>

      {error ? (
        <div className="mt-4">
          <ErrorNote message={error} />
        </div>
      ) : null}

      {loading || !detail ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-4 w-32" />
          <div className="space-y-2 border-t border-line pt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <p className="mt-3 font-mono text-[36px] font-semibold tracking-tight">
            {formatCount(detail.total)}
          </p>
          <p className="text-[13px] text-ink-muted">evaluations in the last {period}</p>

          <div className="mt-5 min-h-0 flex-1 space-y-5 overflow-y-auto border-t border-line pt-4">
            <div>
              <h3 className="mb-2 text-[13px] font-semibold">Environments</h3>
              {detail.environments.length === 0 ? (
                <p className="text-[12px] text-ink-muted">No env breakdown.</p>
              ) : (
                <div className="space-y-2">
                  {detail.environments.map((row) => {
                    const pct = detail.total > 0 ? (row.evaluations / detail.total) * 100 : 0;
                    return (
                      <div key={row.env}>
                        <div className="mb-1 flex items-center justify-between text-[12px]">
                          <span className="font-mono">{row.env}</span>
                          <span className="font-mono text-ink-muted">
                            {formatCount(row.evaluations)}
                          </span>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-line/60">
                          <div
                            className="h-full rounded-full bg-[#0067F4]/85"
                            style={{ width: `${Math.max(pct, 1)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-[13px] font-semibold">Top flags</h3>
              <RankedBars
                rows={detail.flags.slice(0, 8).map((row) => ({
                  key: row.flagKey,
                  label: row.flagKey,
                  mono: true,
                  evaluations: row.evaluations,
                }))}
                total={detail.total}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function EvaluationsMap({
  countries,
  total,
  period,
  selectedCountry,
  onSelectCountry,
  countryDetail,
  countryLoading,
}: {
  countries: CountryPoint[];
  total: number;
  period: AnalyticsPeriod;
  selectedCountry: string | null;
  onSelectCountry: (code: string | null) => void;
  countryDetail: ApiAnalytics | null;
  countryLoading: boolean;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const { resolvedTheme, mounted: themeMounted } = useTheme();
  const [mapReady, setMapReady] = useState(false);
  const [world, setWorld] = useState<WorldCountries | null>(null);
  const [hover, setHover] = useState<{
    longitude: number;
    latitude: number;
    props: WorldCountryProps;
  } | null>(null);

  const mapTheme =
    themeMounted && (resolvedTheme === "dark" || resolvedTheme === "light")
      ? resolvedTheme
      : undefined;

  const { choropleth, mappedCount, minEvals, maxEvals } = useMemo(() => {
    const scored = countries.filter(
      (row) => /^[A-Z]{2}$/.test(row.country) && row.evaluations > 0,
    );
    const values = scored.map((row) => row.evaluations);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    const span = max - min;
    const byIso = new Map(scored.map((row) => [row.country, row.evaluations]));

    if (!world) {
      return { choropleth: null, mappedCount: scored.length, minEvals: min, maxEvals: max };
    }

    const features: WorldCountryFeature[] = world.features.map((feature) => {
      const evaluations = byIso.get(feature.properties.iso) ?? 0;
      const intensity =
        evaluations <= 0 ? 0 : span === 0 ? 1 : (evaluations - min) / span;
      return {
        type: "Feature",
        id: feature.properties.iso,
        properties: {
          iso: feature.properties.iso,
          name: feature.properties.name,
          evaluations,
          intensity,
        },
        geometry: feature.geometry,
      };
    });

    return {
      choropleth: { type: "FeatureCollection" as const, features },
      mappedCount: scored.length,
      minEvals: min,
      maxEvals: max,
    };
  }, [countries, world]);

  useEffect(() => {
    let cancelled = false;
    void fetch(WORLD_COUNTRIES_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load world map (${res.status})`);
        return res.json() as Promise<WorldCountries>;
      })
      .then((data) => {
        if (!cancelled) setWorld(data);
      })
      .catch(() => {
        if (!cancelled) setWorld(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Mount map only after theme settles so we don't mid-load style-swap
  // (setStyle cancels the initial `load` event and left the spinner stuck).
  useEffect(() => {
    if (!themeMounted) return;
    const id = requestAnimationFrame(() => setMapReady(true));
    return () => cancelAnimationFrame(id);
  }, [themeMounted]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !world) return;
    if (!selectedCountry) {
      map.easeTo({ center: WORLD_CENTER, zoom: WORLD_ZOOM, duration: 700 });
      return;
    }
    const feature = world.features.find((f) => f.properties.iso === selectedCountry);
    const bounds = feature ? countryBounds(feature.geometry) : null;
    if (bounds) {
      map.fitBounds(bounds, {
        padding: { top: 56, bottom: 40, left: 40, right: 40 },
        duration: 900,
        maxZoom: 5.5,
      });
      return;
    }
    const center = countryCentroid(selectedCountry);
    if (!center) return;
    map.easeTo({ center, zoom: 4.2, duration: 700 });
  }, [selectedCountry, mapReady, world]);

  const selected = selectedCountry ?? "";
  const lineMuted = mapTheme === "dark" ? "#2e2e2e" : "#e8e4de";
  const focused = Boolean(selectedCountry);

  const cities = countryDetail?.cities ?? [];
  const showCities = focused && !countryLoading && cities.length > 0;
  const maxCityEvals = Math.max(...cities.map((c) => c.evaluations), 1);

  if (!mapReady || !choropleth) {
    return <Skeleton className="h-full w-full rounded-none" />;
  }

  return (
    <>
      <MapView
        ref={mapRef}
        theme={mapTheme}
        center={WORLD_CENTER}
        zoom={WORLD_ZOOM}
        className="h-full w-full"
      >
        <MapGeoJSON<WorldCountryProps>
          data={choropleth}
          promoteId="iso"
          interactive={!showCities}
          fillPaint={{
            "fill-color": [
              "case",
              ["==", ["get", "iso"], selected],
              showCities
                ? "rgba(0, 103, 244, 0.08)"
                : "rgba(0, 103, 244, 0.88)",
              ["==", ["get", "evaluations"], 0],
              "rgba(0, 103, 244, 0)",
              [
                "interpolate",
                ["linear"],
                ["get", "intensity"],
                0,
                "rgba(0, 103, 244, 0.22)",
                0.5,
                "rgba(0, 103, 244, 0.55)",
                1,
                "rgba(0, 103, 244, 0.92)",
              ],
            ],
            "fill-opacity": [
              "case",
              ["==", ["get", "iso"], selected],
              showCities ? 0.35 : 1,
              focused,
              0.08,
              0.92,
            ],
          }}
          fillHoverPaint={
            showCities
              ? undefined
              : {
                  "fill-opacity": 1,
                }
          }
          linePaint={{
            "line-color": [
              "case",
              ["==", ["get", "iso"], selected],
              "#0067F4",
              lineMuted,
            ],
            "line-width": [
              "case",
              ["==", ["get", "iso"], selected],
              2,
              0.5,
            ],
          }}
          onHover={(event) => {
            if (showCities) {
              setHover(null);
              return;
            }
            if (!event || event.feature.properties.evaluations <= 0) {
              setHover(null);
              return;
            }
            setHover({
              longitude: event.longitude,
              latitude: event.latitude,
              props: event.feature.properties,
            });
          }}
          onClick={(event) => {
            if (showCities) return;
            const iso = event.feature.properties.iso;
            if (!iso || event.feature.properties.evaluations <= 0) return;
            onSelectCountry(selectedCountry === iso ? null : iso);
          }}
        />
        {showCities
          ? cities.map((row) => {
              const size = 18 + Math.sqrt(row.evaluations / maxCityEvals) * 28;
              return (
                <MapMarker
                  key={row.city}
                  longitude={row.lng}
                  latitude={row.lat}
                >
                  <MarkerContent>
                    <div
                      className="flex items-center justify-center rounded-full border-2 border-white bg-[#0067F4] font-mono text-[10px] font-semibold text-white shadow-md"
                      style={{ width: size, height: size }}
                      title={`${row.city}: ${formatCount(row.evaluations)} evaluations`}
                    >
                      {formatCount(row.evaluations)}
                    </div>
                    <MarkerLabel position="bottom" className="text-ink">
                      {row.city}
                    </MarkerLabel>
                  </MarkerContent>
                </MapMarker>
              );
            })
          : null}
        {hover && hover.props.iso !== selectedCountry ? (
          <MapPopup
            key={hover.props.iso}
            longitude={hover.longitude}
            latitude={hover.latitude}
            closeButton={false}
            closeOnClick={false}
            className="border-line bg-canvas text-ink shadow-sm duration-200"
          >
            <p className="text-[13px] font-medium">{hover.props.name}</p>
            <p className="mt-0.5 font-mono text-[12px] text-ink-muted">
              {formatCount(hover.props.evaluations)} evaluations
            </p>
          </MapPopup>
        ) : null}
        <MapControls showZoom showFullscreen position="bottom-right" />
      </MapView>
      <div className="pointer-events-none absolute top-4 left-4 z-10 rounded-2xl border border-line/80 bg-canvas/90 px-3.5 py-2.5 shadow-sm backdrop-blur-sm">
        {selectedCountry ? (
          <>
            <p className="text-[12px] text-ink-muted">
              Focused · {period}
              {showCities ? ` · ${cities.length} cities` : null}
            </p>
            <p className="mt-0.5 flex items-center gap-2 text-[14px] font-medium">
              <CountryLabel code={selectedCountry} />
              <span className="font-mono text-[12px] text-ink-muted">
                {countryLoading
                  ? "…"
                  : countryDetail
                    ? `${formatCount(countryDetail.total)} evals`
                    : null}
              </span>
            </p>
            {!countryLoading && countryDetail && cities.length === 0 ? (
              <p className="mt-1.5 text-[11px] text-ink-muted">
                City locations appear as new traffic arrives.
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-[12px] text-ink-muted">Geographic spread · {period}</p>
            <p className="mt-0.5 text-[14px] font-medium">
              {mappedCount} countries
              <span className="ml-1.5 font-mono text-[12px] text-ink-muted">
                {formatCount(total)} evals
              </span>
            </p>
            {mappedCount > 0 ? (
              <div className="mt-2.5 flex items-center gap-2">
                <span className="font-mono text-[10px] text-ink-muted">
                  {formatCount(minEvals)}
                </span>
                <div
                  className="h-1.5 w-24 rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(0,103,244,0.22), rgba(0,103,244,0.92))",
                  }}
                  aria-hidden
                />
                <span className="font-mono text-[10px] text-ink-muted">
                  {formatCount(maxEvals)}
                </span>
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

export function SeriesChart({
  series,
  hourly,
}: {
  series: { bucket: string; evaluations: number }[];
  hourly: boolean;
}) {
  const chart = useMemo(() => {
    const byBucket = new Map(series.map((point) => [point.bucket, point.evaluations]));
    const buckets: { bucket: string; label: string; evaluations: number }[] = [];
    const count = hourly ? 24 : Math.max(series.length, 7);
    const stepMs = hourly ? 3_600_000 : 86_400_000;
    const now = Date.now();
    for (let i = count - 1; i >= 0; i--) {
      const date = new Date(now - i * stepMs);
      const key = hourly
        ? `${date.toISOString().slice(0, 13).replace("T", " ")}:00:00`
        : date.toISOString().slice(0, 10);
      const label = hourly ? `${date.toISOString().slice(11, 13)}:00 UTC` : key;
      buckets.push({ bucket: key, label, evaluations: byBucket.get(key) ?? 0 });
    }
    const max = Math.max(...buckets.map((b) => b.evaluations), 1);
    return { buckets, max };
  }, [series, hourly]);

  const barWidth = 100 / chart.buckets.length;
  return (
    <>
      <svg
        viewBox="0 0 100 40"
        className="h-44 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Evaluations over time bar chart"
      >
        {chart.buckets.map((point, i) => {
          const height = (point.evaluations / chart.max) * 36;
          return (
            <rect
              key={point.bucket}
              x={i * barWidth + barWidth * 0.15}
              y={40 - height}
              width={barWidth * 0.7}
              height={Math.max(height, point.evaluations > 0 ? 0.5 : 0)}
              rx={0.6}
              fill="#0067F4"
              opacity={0.85}
            >
              <title>
                {point.label}: {point.evaluations.toLocaleString()} evaluations
              </title>
            </rect>
          );
        })}
        <line x1="0" y1="40" x2="100" y2="40" stroke="#e8e4de" strokeWidth="0.4" />
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-ink-muted">
        <span>{chart.buckets[0]?.label}</span>
        <span>{chart.buckets[chart.buckets.length - 1]?.label}</span>
      </div>
    </>
  );
}

export function CountryTable({
  countries,
  total,
  selectedCountry,
  onSelectCountry,
  compact = false,
}: {
  countries: { country: string; evaluations: number }[];
  total: number;
  selectedCountry?: string | null;
  onSelectCountry?: (code: string | null) => void;
  compact?: boolean;
}) {
  if (countries.length === 0) {
    return <p className="py-6 text-center text-[13px] text-ink-muted">No country data yet.</p>;
  }

  if (onSelectCountry) {
    const max = Math.max(...countries.map((row) => row.evaluations), 1);
    return (
      <div className={cn("space-y-1", compact && "space-y-0.5")}>
        {countries.map((row) => {
          const pct = total > 0 ? (row.evaluations / total) * 100 : 0;
          const selected = selectedCountry === row.country;
          const hasCentroid = countryCentroid(row.country) != null;
          return (
            <button
              key={row.country}
              type="button"
              onClick={() =>
                onSelectCountry(selected ? null : row.country)
              }
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors",
                selected ? "bg-ink text-canvas" : "hover:bg-canvas",
                !hasCentroid && "opacity-70",
              )}
            >
              <span className="min-w-0 flex-1 truncate text-[13px]">
                <CountryLabel code={row.country} />
              </span>
              {!compact ? (
                <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-line/60 sm:block">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      selected ? "bg-canvas/80" : "bg-[#0067F4]/85",
                    )}
                    style={{ width: `${Math.max((row.evaluations / max) * 100, 1)}%` }}
                  />
                </div>
              ) : null}
              <span
                className={cn(
                  "w-12 shrink-0 text-right font-mono text-[12px]",
                  selected ? "text-canvas/90" : "text-ink",
                )}
              >
                {formatCount(row.evaluations)}
              </span>
              <span
                className={cn(
                  "w-10 shrink-0 text-right text-[11px]",
                  selected ? "text-canvas/70" : "text-ink-muted",
                )}
              >
                {pct < 0.1 ? "<0.1" : pct.toFixed(1)}%
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <RankedBars
      rows={countries.map((row) => ({
        key: row.country,
        label: <CountryLabel code={row.country} />,
        title: countryName(row.country),
        mono: false,
        evaluations: row.evaluations,
      }))}
      total={total}
    />
  );
}

function RankedBars({
  rows,
  total,
}: {
  rows: {
    key: string;
    label: ReactNode;
    title?: string;
    mono: boolean;
    evaluations: number;
  }[];
  total: number;
}) {
  const max = Math.max(...rows.map((row) => row.evaluations), 1);
  if (rows.length === 0) {
    return <p className="py-6 text-center text-[13px] text-ink-muted">Nothing here yet.</p>;
  }
  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const pct = total > 0 ? (row.evaluations / total) * 100 : 0;
        const title =
          row.title ?? (typeof row.label === "string" ? row.label : undefined);
        return (
          <div key={row.key} className="flex items-center gap-3">
            <span
              className={`w-40 shrink-0 truncate text-[13px] ${row.mono ? "font-mono text-[12px]" : ""}`}
              title={title}
            >
              {row.label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-line/60">
              <div
                className="h-full rounded-full bg-[#0067F4]/85"
                style={{ width: `${Math.max((row.evaluations / max) * 100, 1)}%` }}
              />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-[12px]">
              {formatCount(row.evaluations)}
            </span>
            <span className="w-12 shrink-0 text-right text-[12px] text-ink-muted">
              {pct < 0.1 ? "<0.1" : pct.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Skeleton className="h-[420px] w-full rounded-3xl" />
        <div className="rounded-3xl border border-line bg-surface p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-10 w-28" />
          <Skeleton className="mt-2 h-4 w-24" />
          <div className="mt-5 space-y-3 border-t border-line pt-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-line bg-surface p-6 lg:col-span-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-4 h-44 w-full" />
        </div>
        <div className="rounded-3xl border border-line bg-surface p-6">
          <Skeleton className="h-5 w-28" />
          <div className="mt-4 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-line bg-surface p-6">
        <Skeleton className="h-5 w-28" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

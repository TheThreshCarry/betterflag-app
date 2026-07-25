"use client";

import { CountryFlagRounded } from "@appica/country-flags-react";
import { useTheme } from "@appica/ui-react/hooks/use-theme";
import { ANALYTICS_RETENTION_DAYS } from "@shipos/db";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useApp } from "@/components/app-shell";
import { SeriesAreaChart } from "@/components/charts";
import { Card, Chip, EmptyState, ErrorNote } from "@/components/ui";
import {
  Map as MapView,
  MapControls,
  MapGeoJSON,
  MapPopup,
  type MapRef,
} from "@/components/ui/map";
import { Skeleton } from "@/components/ui/skeleton";
import { Stagger } from "@/components/stagger";
import type {
  AnalyticsCityPoint,
  AnalyticsPeriod,
  AnalyticsRegionPoint,
  ApiAnalytics,
  CountryPoint,
} from "@/lib/api-types";
import { api } from "@/lib/client-api";
import { countryCentroid } from "@/lib/country-centroids";
import { analyticsSearchParams } from "@/lib/search-params";
import { staggerStyle } from "@/lib/stagger";
import { cn } from "@/lib/utils";

/** Shared blue intensity paint for country + region choropleths. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- MapLibre expression tuple
const BLUE_FILL_BY_INTENSITY: any = [
  "interpolate",
  ["linear"],
  ["get", "intensity"],
  0,
  "rgba(0, 103, 244, 0.22)",
  0.5,
  "rgba(0, 103, 244, 0.55)",
  1,
  "rgba(0, 103, 244, 0.92)",
];

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

type RegionChoroplethProps = {
  region: string;
  evaluations: number;
  intensity: number;
};

type CityChoroplethProps = {
  city: string;
  evaluations: number;
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

/** Share of total for display; capped at 100 when raw vs MV windows disagree. */
function sharePct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, (part / total) * 100);
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

/** Soft blur while refetching — keep prior values visible, then settle. */
export function SoftRefresh({
  active,
  children,
  className,
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "transition-[filter,opacity] duration-500 ease-out",
        active && "pointer-events-none opacity-55 blur-[3px]",
        className,
      )}
      aria-busy={active || undefined}
    >
      {children}
    </div>
  );
}

export function AnalyticsView() {
  const { org, activeProject, activeEnv } = useApp();
  const [{ period, country: selectedCountry, region: selectedRegion }, setFilters] =
    useQueryStates(analyticsSearchParams, { history: "push" });
  const [data, setData] = useState<ApiAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countryDetail, setCountryDetail] = useState<ApiAnalytics | null>(null);
  const [countryLoading, setCountryLoading] = useState(false);
  const [countryError, setCountryError] = useState<string | null>(null);
  const [regionDetail, setRegionDetail] = useState<ApiAnalytics | null>(null);
  const [regionLoading, setRegionLoading] = useState(false);
  const [regionError, setRegionError] = useState<string | null>(null);

  const retentionDays = ANALYTICS_RETENTION_DAYS[org.plan];
  const envSlug = activeEnv?.slug ?? null;
  const projectEnvKey = `${activeProject?.id ?? ""}:${envSlug ?? ""}`;
  const prevProjectEnvKey = useRef(projectEnvKey);

  const selectCountry = (code: string | null) => {
    void setFilters({ country: code, region: null });
  };

  const selectRegion = (region: string | null) => {
    void setFilters({ region });
  };

  // Drop geo drill-down when project/env changes (stale URL filters).
  useEffect(() => {
    if (prevProjectEnvKey.current === projectEnvKey) return;
    prevProjectEnvKey.current = projectEnvKey;
    void setFilters({ country: null, region: null });
  }, [projectEnvKey, setFilters]);

  useEffect(() => {
    if (!activeProject) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const query = new URLSearchParams({ period, projectId: activeProject.id });
    if (envSlug) query.set("env", envSlug);
    void api<ApiAnalytics>(`/api/v1/analytics?${query.toString()}`)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load analytics");
          setData(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeProject, period, envSlug]);

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
    if (envSlug) query.set("env", envSlug);
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
  }, [activeProject, period, envSlug, selectedCountry]);

  useEffect(() => {
    if (!activeProject || !selectedCountry || !selectedRegion) {
      setRegionDetail(null);
      setRegionError(null);
      setRegionLoading(false);
      return;
    }
    let cancelled = false;
    setRegionLoading(true);
    setRegionDetail(null);
    setRegionError(null);
    const query = new URLSearchParams({
      period,
      projectId: activeProject.id,
      country: selectedCountry,
      region: selectedRegion,
    });
    if (envSlug) query.set("env", envSlug);
    void api<ApiAnalytics>(`/api/v1/analytics?${query.toString()}`)
      .then((result) => {
        if (!cancelled) {
          setRegionDetail(result);
          setRegionLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setRegionError(
            err instanceof Error ? err.message : "Failed to load region analytics",
          );
          setRegionLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeProject, period, envSlug, selectedCountry, selectedRegion]);

  if (!activeProject) {
    return (
      <EmptyState
        title="No project selected"
        body="Create or select a project to see its evaluation analytics."
      />
    );
  }

  const showEmpty = !loading && !error && data !== null && data.total === 0;

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

      <div className="mb-6 flex flex-wrap items-center gap-1.5" role="group" aria-label="Timeframe">
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
              onClick={() => void setFilters({ period: value })}
            >
              {label}
            </FilterButton>
          );
        })}
      </div>

      {error ? <ErrorNote message={error} /> : null}
      {showEmpty ? (
        <EmptyState
          title="No evaluations in this period"
          body="Once your SDKs or agents evaluate flags, country and flag breakdowns show up here."
        />
      ) : null}
      {!error && !showEmpty ? (
        <AnalyticsContent
          data={data}
          loading={loading}
          period={period}
          selectedCountry={selectedCountry}
          onSelectCountry={selectCountry}
          selectedRegion={selectedRegion}
          onSelectRegion={selectRegion}
          countryDetail={countryDetail}
          countryLoading={countryLoading}
          countryError={countryError}
          regionDetail={regionDetail}
          regionLoading={regionLoading}
          regionError={regionError}
          className="min-h-[520px]"
        />
      ) : null}
    </Stagger>
  );
}

/** Map + country/region/city sidebar — shared by Analytics and flag detail. */
export function AnalyticsMapPanel({
  countries,
  total,
  period,
  initialLoad,
  refreshing,
  hasData,
  selectedCountry,
  onSelectCountry,
  selectedRegion,
  onSelectRegion,
  countryDetail,
  countryLoading,
  countryError,
  regionDetail,
  regionLoading,
  regionError,
  hideTopFlags = false,
  staggerFrom = 0,
  className,
}: {
  countries: CountryPoint[];
  total: number;
  period: AnalyticsPeriod;
  initialLoad: boolean;
  refreshing: boolean;
  hasData: boolean;
  selectedCountry: string | null;
  onSelectCountry: (code: string | null) => void;
  selectedRegion: string | null;
  onSelectRegion: (region: string | null) => void;
  countryDetail: ApiAnalytics | null;
  countryLoading: boolean;
  countryError: string | null;
  regionDetail: ApiAnalytics | null;
  regionLoading: boolean;
  regionError: string | null;
  hideTopFlags?: boolean;
  staggerFrom?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]",
        className,
      )}
    >
      {/*
        Map must NOT sit under stagger-in / CSS filter. Those break MapLibre
        WebGL. Refresh uses a sibling overlay, not filter on the canvas.
      */}
      <div className="relative h-[320px] min-w-0 overflow-hidden rounded-3xl border border-line bg-surface sm:h-[380px] xl:h-[420px]">
        {initialLoad || !hasData ? (
          <Skeleton className="h-full w-full rounded-none" />
        ) : (
          <>
            <EvaluationsMap
              countries={countries}
              total={total}
              period={period}
              selectedCountry={selectedCountry}
              onSelectCountry={onSelectCountry}
              selectedRegion={selectedRegion}
              onSelectRegion={onSelectRegion}
              countryDetail={countryDetail}
              countryLoading={countryLoading}
              regionDetail={regionDetail}
              regionLoading={regionLoading}
            />
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-0 z-[2] bg-surface/35 backdrop-blur-[2px] transition-opacity duration-500 ease-out",
                refreshing ? "opacity-100" : "opacity-0",
              )}
            />
          </>
        )}
      </div>
      <div className="stagger-in min-w-0 xl:h-[420px]" style={staggerStyle(staggerFrom)}>
        <Card className="flex min-w-0 flex-col overflow-hidden px-4 pt-5 pb-3 xl:h-full xl:px-3 xl:pt-4 xl:pb-2">
          <div className="min-h-0 xl:flex-1 xl:overflow-hidden">
            <div
              className={cn(
                "flex w-[200%] transition-transform duration-500 ease-out xl:h-full",
                selectedCountry && !refreshing ? "-translate-x-1/2" : "translate-x-0",
              )}
            >
              <div
                className={cn(
                  "flex w-1/2 min-w-0 flex-col xl:h-full",
                  selectedCountry && !refreshing && "pointer-events-none",
                )}
                aria-hidden={Boolean(selectedCountry && !refreshing)}
              >
                <p className="text-[12px] font-medium tracking-wide text-ink-muted uppercase">
                  Evaluations
                </p>
                {initialLoad ? (
                  <>
                    <Skeleton className="mt-1 h-10 w-28" />
                    <Skeleton className="mt-2 h-4 w-32" />
                  </>
                ) : (
                  <SoftRefresh active={refreshing}>
                    <p className="mt-1 font-mono text-[36px] font-semibold tracking-tight">
                      {formatCount(total)}
                    </p>
                    <p className="text-[13px] text-ink-muted">in the last {period}</p>
                  </SoftRefresh>
                )}
                <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
                  <h2 className="text-[14px] font-semibold">By country</h2>
                  {initialLoad ? (
                    <Skeleton className="h-3 w-6" />
                  ) : (
                    <SoftRefresh active={refreshing}>
                      <span className="text-[12px] text-ink-muted">{countries.length}</span>
                    </SoftRefresh>
                  )}
                </div>
                <div className="mt-3 min-h-0 min-w-0 xl:flex-1 xl:overflow-x-hidden xl:overflow-y-auto xl:pr-1">
                  {initialLoad ? (
                    <div className="space-y-2">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : (
                    <SoftRefresh active={refreshing}>
                      <CountryTable
                        countries={countries}
                        total={total}
                        selectedCountry={selectedCountry}
                        onSelectCountry={onSelectCountry}
                        compact
                      />
                    </SoftRefresh>
                  )}
                </div>
              </div>
              <div
                className={cn(
                  "flex w-1/2 min-w-0 flex-col xl:h-full",
                  (!selectedCountry || refreshing) && "pointer-events-none",
                )}
                aria-hidden={!selectedCountry || refreshing}
              >
                {selectedCountry && !refreshing ? (
                  selectedRegion ? (
                    <RegionDetailPanel
                      country={selectedCountry}
                      region={selectedRegion}
                      detail={regionDetail}
                      loading={regionLoading}
                      error={regionError}
                      period={period}
                      onBack={() => onSelectRegion(null)}
                    />
                  ) : (
                    <CountryDetailPanel
                      country={selectedCountry}
                      detail={countryDetail}
                      loading={countryLoading}
                      error={countryError}
                      period={period}
                      onClear={() => onSelectCountry(null)}
                      onSelectRegion={(region) => onSelectRegion(region)}
                      hideTopFlags={hideTopFlags}
                    />
                  )
                ) : null}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function AnalyticsContent({
  data,
  loading,
  period,
  selectedCountry,
  onSelectCountry,
  selectedRegion,
  onSelectRegion,
  countryDetail,
  countryLoading,
  countryError,
  regionDetail,
  regionLoading,
  regionError,
  staggerFrom = 0,
  className,
}: {
  data: ApiAnalytics | null;
  loading: boolean;
  period: AnalyticsPeriod;
  selectedCountry: string | null;
  onSelectCountry: (code: string | null) => void;
  selectedRegion: string | null;
  onSelectRegion: (region: string | null) => void;
  countryDetail: ApiAnalytics | null;
  countryLoading: boolean;
  countryError: string | null;
  regionDetail: ApiAnalytics | null;
  regionLoading: boolean;
  regionError: string | null;
  staggerFrom?: number;
  className?: string;
}) {
  const countries = data?.countries ?? [];
  const total = data?.total ?? 0;
  const series = data?.series ?? [];
  const flags = data?.flags ?? [];
  /** Refetch with prior data on screen — blur instead of skeleton. */
  const refreshing = loading && data !== null;
  const initialLoad = loading && data === null;
  /** Prefer selected period so the label updates while blurred. */
  const displayPeriod = period;

  return (
    <div className={cn("space-y-6", className)}>
      <AnalyticsMapPanel
        countries={countries}
        total={total}
        period={displayPeriod}
        initialLoad={initialLoad}
        refreshing={refreshing}
        hasData={data !== null}
        selectedCountry={selectedCountry}
        onSelectCountry={onSelectCountry}
        selectedRegion={selectedRegion}
        onSelectRegion={onSelectRegion}
        countryDetail={countryDetail}
        countryLoading={countryLoading}
        countryError={countryError}
        regionDetail={regionDetail}
        regionLoading={regionLoading}
        regionError={regionError}
        staggerFrom={staggerFrom}
      />

      <Stagger from={staggerFrom + 1} className="space-y-6">
        <Card className="p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-[16px] font-semibold">Over time</h2>
            <span className="text-[12px] text-ink-muted">
              {displayPeriod === "24h" ? "hourly" : "daily"}
            </span>
          </div>
          {initialLoad ? (
            <Skeleton className="h-44 w-full" />
          ) : (
            <SoftRefresh active={refreshing}>
              <SeriesChart series={series} hourly={displayPeriod === "24h"} />
            </SoftRefresh>
          )}
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-[16px] font-semibold">Top flags</h2>
            <span className="text-[12px] text-ink-muted">by evaluations</span>
          </div>
          {initialLoad ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : (
            <SoftRefresh active={refreshing}>
              <RankedBars
                rows={flags.map((row) => ({
                  key: row.flagKey,
                  label: row.flagKey,
                  mono: true,
                  evaluations: row.evaluations,
                }))}
                total={total}
              />
            </SoftRefresh>
          )}
        </Card>
      </Stagger>
    </div>
  );
}

function RegionDetailPanel({
  country,
  region,
  detail,
  loading,
  error,
  period,
  onBack,
}: {
  country: string;
  region: string;
  detail: ApiAnalytics | null;
  loading: boolean;
  error: string | null;
  period: AnalyticsPeriod;
  onBack: () => void;
}) {
  const cities = detail?.cities ?? [];
  const total = detail?.total ?? cities.reduce((s, c) => s + c.evaluations, 0);

  return (
    <div className="flex min-h-0 min-w-0 flex-col xl:h-full">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to regions"
          title="Back to regions"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </button>
        {/^[A-Z]{2}$/.test(country) ? (
          <CountryFlagRounded
            code={country.toLowerCase()}
            size={16}
            title={countryName(country)}
            className="shrink-0"
          />
        ) : null}
        <span className="shrink-0 font-mono text-[12px] tracking-wide text-ink-muted uppercase">
          {country}
        </span>
        <span className="text-ink-muted" aria-hidden>
          /
        </span>
        <p className="min-w-0 flex-1 truncate text-[16px] font-semibold">{region}</p>
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
          <p className="mt-3 font-mono text-[32px] font-semibold tracking-tight sm:text-[36px]">
            {formatCount(total)}
          </p>
          <p className="text-[13px] text-ink-muted">evaluations in the last {period}</p>

          <div className="mt-5 min-h-0 min-w-0 space-y-3 border-t border-line pt-4 xl:flex-1 xl:overflow-x-hidden xl:overflow-y-auto">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[13px] font-semibold">Cities</h3>
              <span className="text-[12px] text-ink-muted">{cities.length}</span>
            </div>
            {cities.length === 0 ? (
              <p className="text-[12px] text-ink-muted">
                City locations appear as new traffic arrives.
              </p>
            ) : (
              <ul className="space-y-2">
                {cities.map((row) => {
                  const pct = sharePct(row.evaluations, total);
                  return (
                    <li key={row.city} className="min-w-0">
                      <div className="mb-1 flex min-w-0 items-center justify-between gap-2 text-[12px]">
                        <span className="min-w-0 truncate font-medium">{row.city}</span>
                        <span className="shrink-0 font-mono text-ink-muted">
                          {formatCount(row.evaluations)}
                          <span className="ml-2 text-[11px] tabular-nums">
                            {pct < 1 && pct > 0 ? "<1" : pct.toFixed(0)}%
                          </span>
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-line/60">
                        <div
                          className="h-full rounded-full bg-[#0067F4]/85"
                          style={{ width: `${Math.max(pct, 1)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
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
  onSelectRegion,
  hideTopFlags = false,
}: {
  country: string;
  detail: ApiAnalytics | null;
  loading: boolean;
  error: string | null;
  period: AnalyticsPeriod;
  onClear: () => void;
  onSelectRegion: (region: string) => void;
  /** Flag detail already scopes to one flag — hide redundant top-flags list. */
  hideTopFlags?: boolean;
}) {
  const regions = detail?.regions ?? [];
  const total =
    detail?.total ?? regions.reduce((sum, row) => sum + row.evaluations, 0);

  return (
    <div className="flex min-h-0 min-w-0 flex-col xl:h-full">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          aria-label="Back to countries"
          title="Back to countries"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </button>
        <div className="min-w-0 flex-1 truncate text-[16px] font-semibold">
          <CountryLabel code={country} />
        </div>
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
          <p className="mt-3 font-mono text-[32px] font-semibold tracking-tight sm:text-[36px]">
            {formatCount(total)}
          </p>
          <p className="text-[13px] text-ink-muted">evaluations in the last {period}</p>

          <div className="mt-5 min-h-0 min-w-0 space-y-5 border-t border-line pt-4 xl:flex-1 xl:overflow-x-hidden xl:overflow-y-auto">
            <div className="min-w-0">
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-[13px] font-semibold">Regions</h3>
                <span className="text-[12px] text-ink-muted">{regions.length}</span>
              </div>
              {regions.length === 0 ? (
                <p className="text-[12px] text-ink-muted">
                  Region locations appear as new traffic arrives.
                </p>
              ) : (
                <ul className="space-y-2">
                  {regions.map((row) => {
                    const pct = sharePct(row.evaluations, total);
                    return (
                      <li key={row.region} className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onSelectRegion(row.region)}
                          className="w-full cursor-pointer rounded-md px-1 py-1 text-left transition-colors hover:bg-surface"
                        >
                          <div className="mb-1 flex min-w-0 items-center justify-between gap-2 text-[12px]">
                            <span className="min-w-0 truncate font-medium">{row.region}</span>
                            <span className="shrink-0 font-mono text-ink-muted">
                              {formatCount(row.evaluations)}
                              <span className="ml-2 text-[11px] tabular-nums">
                                {pct < 1 && pct > 0 ? "<1" : pct.toFixed(0)}%
                              </span>
                            </span>
                          </div>
                          <div className="h-1 overflow-hidden rounded-full bg-line/60">
                            <div
                              className="h-full rounded-full bg-[#0067F4]/85"
                              style={{ width: `${Math.max(pct, 1)}%` }}
                            />
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {hideTopFlags ? null : (
              <div className="min-w-0">
                <h3 className="mb-2 text-[13px] font-semibold">Top flags</h3>
                <RankedBars
                  compact
                  rows={detail.flags.slice(0, 8).map((row) => ({
                    key: row.flagKey,
                    label: row.flagKey,
                    mono: true,
                    evaluations: row.evaluations,
                  }))}
                  total={detail.total}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Fallback footprint when OSM has no region polygon yet.
 * Prefer real boundaries from `/api/v1/geo/region-boundaries`.
 */
function regionCirclePolygon(
  lng: number,
  lat: number,
  radiusKm: number,
  steps = 48,
): GeoJSON.Polygon {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const R = 6371;
  const lat1 = toRad(lat);
  const lng1 = toRad(lng);
  const ang = radiusKm / R;
  const ring: GeoJSON.Position[] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 2 * Math.PI;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(ang) +
        Math.cos(lat1) * Math.sin(ang) * Math.cos(bearing),
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(ang) * Math.cos(lat1),
        Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2),
      );
    ring.push([toDeg(lng2), toDeg(lat2)]);
  }
  return { type: "Polygon", coordinates: [ring] };
}

type BoundaryMap = Map<string, GeoJSON.Polygon | GeoJSON.MultiPolygon>;

/** Region polygons styled like the country choropleth (intensity → blue fill). */
function regionsToChoropleth(
  regions: readonly AnalyticsRegionPoint[],
  boundaries: BoundaryMap | null,
): GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  RegionChoroplethProps
> {
  const values = regions.map((c) => c.evaluations);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const span = max - min;
  return {
    type: "FeatureCollection",
    features: regions.map((row) => {
      const intensity = span === 0 ? 1 : (row.evaluations - min) / span;
      const osm = boundaries?.get(row.region);
      const geometry =
        osm ??
        regionCirclePolygon(row.lng, row.lat, 18 + Math.sqrt(intensity) * 22);
      return {
        type: "Feature",
        id: row.region,
        properties: {
          region: row.region,
          evaluations: row.evaluations,
          intensity,
        },
        geometry,
      };
    }),
  };
}

/** City polygons for region drill-down. */
function citiesToChoropleth(
  cities: readonly AnalyticsCityPoint[],
  boundaries: BoundaryMap | null,
): GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  CityChoroplethProps
> {
  const values = cities.map((c) => c.evaluations);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const span = max - min;
  return {
    type: "FeatureCollection",
    features: cities.map((row) => {
      const intensity = span === 0 ? 1 : (row.evaluations - min) / span;
      const osm = boundaries?.get(row.city);
      const geometry =
        osm ??
        regionCirclePolygon(row.lng, row.lat, 8 + Math.sqrt(intensity) * 12);
      return {
        type: "Feature",
        id: row.city,
        properties: {
          city: row.city,
          evaluations: row.evaluations,
          intensity,
        },
        geometry,
      };
    }),
  };
}

function EvaluationsMap({
  countries,
  total,
  period,
  selectedCountry,
  onSelectCountry,
  selectedRegion,
  onSelectRegion,
  countryDetail,
  countryLoading,
  regionDetail,
  regionLoading,
}: {
  countries: CountryPoint[];
  total: number;
  period: AnalyticsPeriod;
  selectedCountry: string | null;
  onSelectCountry: (code: string | null) => void;
  selectedRegion: string | null;
  onSelectRegion: (region: string | null) => void;
  countryDetail: ApiAnalytics | null;
  countryLoading: boolean;
  regionDetail: ApiAnalytics | null;
  regionLoading: boolean;
}) {
  const mapRef = useRef<MapRef | null>(null);
  /** Saved basemap paint props so focus dim can restore cleanly. */
  const basemapDimBackupRef = useRef<Map<string, Record<string, unknown>>>(new Map());
  const { resolvedTheme, mounted: themeMounted } = useTheme();
  const [mapReady, setMapReady] = useState(false);
  const [world, setWorld] = useState<WorldCountries | null>(null);
  const [hover, setHover] = useState<{
    longitude: number;
    latitude: number;
    kind: "country";
    props: WorldCountryProps;
  } | null>(null);
  const [regionHover, setRegionHover] = useState<{
    longitude: number;
    latitude: number;
    props: RegionChoroplethProps;
  } | null>(null);
  const [cityHover, setCityHover] = useState<{
    longitude: number;
    latitude: number;
    props: CityChoroplethProps;
  } | null>(null);
  const [focusDetailsOpen, setFocusDetailsOpen] = useState(false);
  const [regionBoundaries, setRegionBoundaries] = useState<BoundaryMap | null>(null);
  const [cityBoundaries, setCityBoundaries] = useState<BoundaryMap | null>(null);

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

  // Camera follows focus: world ← country ← region (incl. stepping back via badge).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !world) return;

    if (!selectedCountry) {
      map.easeTo({ center: WORLD_CENTER, zoom: WORLD_ZOOM, duration: 700 });
      return;
    }

    if (selectedRegion) {
      const regionGeom = regionBoundaries?.get(selectedRegion);
      const regionBounds = regionGeom ? countryBounds(regionGeom) : null;
      if (regionBounds) {
        map.fitBounds(regionBounds, {
          padding: { top: 56, bottom: 40, left: 40, right: 40 },
          duration: 800,
          maxZoom: 9,
        });
        return;
      }
      // OSM polygon missing (or still loading) — zoom to analytics centroid.
      const point = countryDetail?.regions?.find((r) => r.region === selectedRegion);
      if (
        point &&
        Number.isFinite(point.lng) &&
        Number.isFinite(point.lat)
      ) {
        map.easeTo({
          center: [point.lng, point.lat],
          zoom: 7.5,
          duration: 800,
        });
        return;
      }
    }

    const feature = world.features.find((f) => f.properties.iso === selectedCountry);
    const bounds = feature ? countryBounds(feature.geometry) : null;
    if (bounds) {
      map.fitBounds(bounds, {
        padding: { top: 56, bottom: 40, left: 40, right: 40 },
        duration: 900,
        maxZoom: 6.5,
      });
      return;
    }
    const center = countryCentroid(selectedCountry);
    if (!center) return;
    map.easeTo({ center, zoom: 5, duration: 700 });
  }, [
    selectedCountry,
    selectedRegion,
    regionBoundaries,
    mapReady,
    world,
    countryDetail,
  ]);

  const selected = selectedCountry ?? "";
  const lineMuted = mapTheme === "dark" ? "#2e2e2e" : "#e8e4de";
  const focused = Boolean(selectedCountry);
  const regionFocused = Boolean(selectedCountry && selectedRegion);
  const veilColor =
    mapTheme === "dark" ? "rgba(6, 8, 12, 0.72)" : "rgba(245, 242, 236, 0.62)";

  // Click outside the focused country (veil / ocean / other countries) → world.
  // Selected country fill itself is inert; regions/cities handle their own clicks.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !focused || !selectedCountry) return;

    const onMapClick = (event: { point: [number, number] | { x: number; y: number } }) => {
      const fillLayers = (map.getStyle()?.layers ?? [])
        .map((layer) => layer.id)
        .filter((id) => id.startsWith("geojson-fill-") && map.getLayer(id));
      if (fillLayers.length === 0) {
        onSelectCountry(null);
        return;
      }

      const point: [number, number] = Array.isArray(event.point)
        ? event.point
        : [event.point.x, event.point.y];
      const hits = map.queryRenderedFeatures(point, { layers: fillLayers });
      const hitCity = hits.some((f) => typeof f.properties?.city === "string");
      const hitRegion = hits.some((f) => typeof f.properties?.region === "string");
      const hitSelectedCountry = hits.some(
        (f) => f.properties?.iso === selectedCountry,
      );

      // Regions/cities consume the click via their layer handlers.
      if (hitCity || hitRegion) return;
      // Selected country body: ignore (only subdivisions are interactive).
      if (hitSelectedCountry) return;
      onSelectCountry(null);
    };

    map.on("click", onMapClick);
    return () => {
      map.off("click", onMapClick);
    };
  }, [focused, mapReady, selectedCountry, onSelectCountry]);

  // Dim Carto basemap (labels, land, water) outside our GeoJSON layers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const isDataLayer = (id: string) =>
      id.startsWith("geojson-fill-") || id.startsWith("geojson-line-");

    const backup = basemapDimBackupRef.current;

    const restore = () => {
      for (const [layerId, props] of backup) {
        if (!map.getLayer(layerId)) continue;
        for (const [prop, value] of Object.entries(props)) {
          try {
            map.setPaintProperty(layerId, prop, value as never);
          } catch {
            /* layer/prop may be gone after style swap */
          }
        }
      }
      backup.clear();
    };

    if (!focused) {
      restore();
      return;
    }

    const applyDim = () => {
      if (!map.isStyleLoaded()) return;
      restore();

      for (const layer of map.getStyle()?.layers ?? []) {
        if (isDataLayer(layer.id) || !map.getLayer(layer.id)) continue;

        const saved: Record<string, unknown> = {};
        const dim = (prop: string, value: number) => {
          try {
            saved[prop] = map.getPaintProperty(layer.id, prop);
            map.setPaintProperty(layer.id, prop, value);
          } catch {
            /* unsupported on this layer */
          }
        };

        if (layer.type === "symbol") {
          dim("text-opacity", 0.16);
          dim("icon-opacity", 0.16);
        } else if (layer.type === "fill") {
          dim("fill-opacity", 0.32);
        } else if (layer.type === "line") {
          dim("line-opacity", 0.18);
        } else if (layer.type === "raster") {
          dim("raster-opacity", 0.4);
        } else if (layer.type === "circle") {
          dim("circle-opacity", 0.22);
        } else if (layer.type === "fill-extrusion") {
          dim("fill-extrusion-opacity", 0.25);
        }

        if (Object.keys(saved).length > 0) {
          backup.set(layer.id, saved);
        }
      }
    };

    applyDim();
    map.on("style.load", applyDim);

    return () => {
      map.off("style.load", applyDim);
      restore();
    };
  }, [focused, mapReady, mapTheme, selectedCountry, selectedRegion]);

  const regions = countryDetail?.regions ?? [];
  const cities = regionDetail?.cities ?? [];
  const showRegions = focused && !regionFocused && !countryLoading && regions.length > 0;
  const showCities = regionFocused && !regionLoading && cities.length > 0;
  /** All regions, or just the focused one under cities (click → back to country). */
  const regionChoropleth = useMemo(() => {
    if (showRegions) return regionsToChoropleth(regions, regionBoundaries);
    if (regionFocused && selectedRegion) {
      const row = regions.find((r) => r.region === selectedRegion);
      return row ? regionsToChoropleth([row], regionBoundaries) : null;
    }
    return null;
  }, [showRegions, regionFocused, selectedRegion, regions, regionBoundaries]);
  const cityChoropleth = useMemo(
    () => (showCities ? citiesToChoropleth(cities, cityBoundaries) : null),
    [showCities, cities, cityBoundaries],
  );
  const hasFocusDetails = regionFocused ? cities.length > 0 : regions.length > 0;

  useEffect(() => {
    if (!showRegions) setRegionHover(null);
  }, [showRegions]);

  useEffect(() => {
    if (!showCities) setCityHover(null);
  }, [showCities]);

  useEffect(() => {
    setFocusDetailsOpen(false);
    setRegionBoundaries(null);
  }, [selectedCountry]);

  useEffect(() => {
    setFocusDetailsOpen(false);
    setCityBoundaries(null);
  }, [selectedRegion]);

  const regionNamesKey = regions.map((r) => r.region).join("\0");
  const cityNamesKey = cities.map((c) => c.city).join("\0");

  // Fetch OSM state/region polygons (circle fallback until ready).
  // Keep fetching even after a region is selected — aborting on regionFocus
  // left regionBoundaries null and blocked list-click zoom.
  useEffect(() => {
    if (!selectedCountry || !regionNamesKey) return;
    let cancelled = false;
    const names = regionNamesKey.split("\0");
    const query = new URLSearchParams({
      country: selectedCountry,
      regions: names.join(","),
    });
    void api<GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, { region: string }>>(
      `/api/v1/geo/region-boundaries?${query.toString()}`,
    )
      .then((fc) => {
        if (cancelled) return;
        const map: BoundaryMap = new Map();
        for (const feature of fc.features) {
          const name = feature.properties?.region;
          if (name && (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon")) {
            map.set(name, feature.geometry);
          }
        }
        setRegionBoundaries(map);
      })
      .catch(() => {
        if (!cancelled) setRegionBoundaries(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCountry, regionNamesKey]);

  // Fetch OSM city polygons when a region is focused.
  useEffect(() => {
    if (!selectedCountry || !cityNamesKey || !regionFocused) return;
    let cancelled = false;
    const names = cityNamesKey.split("\0");
    const query = new URLSearchParams({
      country: selectedCountry,
      cities: names.join(","),
    });
    void api<GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, { city: string }>>(
      `/api/v1/geo/city-boundaries?${query.toString()}`,
    )
      .then((fc) => {
        if (cancelled) return;
        const map: BoundaryMap = new Map();
        for (const feature of fc.features) {
          const name = feature.properties?.city;
          if (name && (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon")) {
            map.set(name, feature.geometry);
          }
        }
        setCityBoundaries(map);
      })
      .catch(() => {
        if (!cancelled) setCityBoundaries(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCountry, cityNamesKey, regionFocused]);

  if (!mapReady || !choropleth) {
    return <Skeleton className="h-full w-full rounded-none" />;
  }

  const focusTotal = regionFocused
    ? (regionDetail?.total ?? cities.reduce((sum, row) => sum + row.evaluations, 0))
    : (countryDetail?.total ??
      regions.reduce((sum, row) => sum + row.evaluations, 0));

  return (
    <div className="relative h-full w-full">
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
          interactive
          fillPaint={{
            "fill-color": [
              "case",
              // Focused country: no fill — regions/cities carry the color.
              ["==", ["get", "iso"], selected],
              "rgba(0, 103, 244, 0)",
              focused,
              veilColor,
              ["==", ["get", "evaluations"], 0],
              "rgba(0, 103, 244, 0)",
              BLUE_FILL_BY_INTENSITY,
            ],
            "fill-opacity": [
              "case",
              ["==", ["get", "iso"], selected],
              0,
              focused,
              1,
              0.92,
            ],
          }}
          fillHoverPaint={
            focused
              ? undefined
              : {
                  "fill-opacity": 1,
                  "fill-color": [
                    "case",
                    ["==", ["get", "evaluations"], 0],
                    "rgba(0, 103, 244, 0)",
                    "rgba(0, 103, 244, 0.95)",
                  ],
                }
          }
          linePaint={{
            "line-color": [
              "case",
              ["==", ["get", "iso"], selected],
              "#0067F4",
              focused,
              mapTheme === "dark" ? "#1a1a1a" : "#d8d4ce",
              lineMuted,
            ],
            "line-width": [
              "case",
              ["==", ["get", "iso"], selected],
              1.5,
              0.4,
            ],
            "line-opacity": [
              "case",
              ["==", ["get", "iso"], selected],
              0.85,
              focused,
              0.35,
              1,
            ],
          }}
          onHover={(event) => {
            // While focused, country fill is inert — no hover chrome on it.
            if (focused) {
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
              kind: "country",
              props: event.feature.properties,
            });
          }}
          onClick={(event) => {
            const iso = event.feature.properties.iso;
            if (!iso) return;
            if (focused) {
              // Selected country: ignore. Anywhere else → world.
              if (iso !== selectedCountry) onSelectCountry(null);
              return;
            }
            if (event.feature.properties.evaluations <= 0) return;
            onSelectCountry(iso);
          }}
        />
        {regionChoropleth ? (
          <MapGeoJSON<RegionChoroplethProps>
            data={regionChoropleth}
            promoteId="region"
            interactive={!regionFocused}
            fillPaint={{
              "fill-color": BLUE_FILL_BY_INTENSITY,
              "fill-opacity": regionFocused ? 0.28 : 0.88,
            }}
            fillHoverPaint={
              regionFocused
                ? undefined
                : {
                    "fill-opacity": 1,
                    "fill-color": "rgba(0, 103, 244, 0.95)",
                  }
            }
            linePaint={{
              "line-color": "#0067F4",
              "line-width": regionFocused ? 2 : 1.5,
            }}
            onHover={(event) => {
              if (regionFocused || !event) {
                setRegionHover(null);
                return;
              }
              setRegionHover({
                longitude: event.longitude,
                latitude: event.latitude,
                props: event.feature.properties,
              });
            }}
            onClick={(event) => {
              if (regionFocused) return;
              const name = event.feature.properties.region;
              if (!name) return;
              onSelectRegion(name);
            }}
          />
        ) : null}
        {cityChoropleth ? (
          <MapGeoJSON<CityChoroplethProps>
            data={cityChoropleth}
            promoteId="city"
            interactive
            fillPaint={{
              "fill-color": BLUE_FILL_BY_INTENSITY,
              "fill-opacity": 0.88,
            }}
            fillHoverPaint={{
              "fill-opacity": 1,
              "fill-color": "rgba(0, 103, 244, 0.95)",
            }}
            linePaint={{
              "line-color": "#0067F4",
              "line-width": 1.5,
            }}
            onHover={(event) => {
              if (!event) {
                setCityHover(null);
                return;
              }
              setCityHover({
                longitude: event.longitude,
                latitude: event.latitude,
                props: event.feature.properties,
              });
            }}
          />
        ) : null}
        {regionHover && !regionFocused ? (
          <MapPopup
            key={regionHover.props.region}
            longitude={regionHover.longitude}
            latitude={regionHover.latitude}
            closeButton={false}
            closeOnClick={false}
            className="border-line bg-canvas text-ink shadow-sm duration-200"
          >
            <p className="text-[13px] font-medium">{regionHover.props.region}</p>
            <p className="mt-0.5 font-mono text-[12px] text-ink-muted">
              {formatCount(regionHover.props.evaluations)} evaluations
            </p>
          </MapPopup>
        ) : null}
        {cityHover ? (
          <MapPopup
            key={cityHover.props.city}
            longitude={cityHover.longitude}
            latitude={cityHover.latitude}
            closeButton={false}
            closeOnClick={false}
            className="border-line bg-canvas text-ink shadow-sm duration-200"
          >
            <p className="text-[13px] font-medium">{cityHover.props.city}</p>
            <p className="mt-0.5 font-mono text-[12px] text-ink-muted">
              {formatCount(cityHover.props.evaluations)} evaluations
            </p>
          </MapPopup>
        ) : null}
        {hover && !focused ? (
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
      <div className="pointer-events-none absolute top-4 left-4 z-10 max-w-[min(320px,calc(100%-2rem))]">
        {selectedCountry ? (
          <div
            className="pointer-events-auto overflow-hidden rounded-2xl border border-line/80 bg-canvas/90 shadow-sm backdrop-blur-sm"
            onMouseEnter={() => {
              setHover(null);
              setRegionHover(null);
              setCityHover(null);
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-3 py-2.5">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-[12px] text-ink-muted">
                  Focused · {period}
                  {regionFocused
                    ? cities.length > 0
                      ? ` · ${cities.length} cities`
                      : null
                    : showRegions
                      ? ` · ${regions.length} regions`
                      : null}
                </p>
                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[14px] font-medium">
                  <button
                    type="button"
                    onClick={() => {
                      // Region drill-down → country; country focus → world.
                      if (selectedRegion) onSelectRegion(null);
                      else onSelectCountry(null);
                    }}
                    title={selectedRegion ? "Back to country" : "Back to world"}
                    className="inline-flex min-w-0 max-w-full items-center rounded-md px-1 py-0.5 transition-colors hover:bg-surface"
                  >
                    <CountryLabel code={selectedCountry} />
                  </button>
                  {selectedRegion ? (
                    <>
                      <span className="text-ink-muted" aria-hidden>
                        /
                      </span>
                      <span className="truncate px-1 py-0.5 text-ink">
                        {selectedRegion}
                      </span>
                    </>
                  ) : null}
                  <span className="font-mono text-[12px] text-ink-muted">
                    {regionFocused
                      ? regionLoading
                        ? "…"
                        : `${formatCount(focusTotal)} evals`
                      : countryLoading
                        ? "…"
                        : countryDetail
                          ? `${formatCount(countryDetail.total)} evals`
                          : null}
                  </span>
                </div>
                {!regionFocused &&
                !countryLoading &&
                countryDetail &&
                regions.length === 0 ? (
                  <p className="mt-1 text-[11px] text-ink-muted">
                    Region locations appear as new traffic arrives.
                  </p>
                ) : null}
                {regionFocused &&
                !regionLoading &&
                regionDetail &&
                cities.length === 0 ? (
                  <p className="mt-1 text-[11px] text-ink-muted">
                    City locations appear as new traffic arrives.
                  </p>
                ) : null}
              </div>
              {hasFocusDetails ? (
                <button
                  type="button"
                  onClick={() => setFocusDetailsOpen((open) => !open)}
                  aria-expanded={focusDetailsOpen}
                  aria-label={focusDetailsOpen ? "Hide breakdown" : "Show breakdown"}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line/80 text-ink transition-colors hover:bg-surface"
                >
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform duration-200",
                      focusDetailsOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
              ) : null}
            </div>
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-500 ease-out",
                focusDetailsOpen && hasFocusDetails
                  ? "grid-rows-[1fr]"
                  : "grid-rows-[0fr]",
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="max-h-56 overflow-y-auto border-t border-line/80 px-3.5 py-2">
                  {regionFocused ? (
                    <ul className="space-y-1.5">
                      {cities.map((row) => {
                        const pct = sharePct(row.evaluations, focusTotal);
                        return (
                          <li
                            key={row.city}
                            className="flex items-baseline justify-between gap-3 text-[12px]"
                          >
                            <span className="min-w-0 truncate font-medium">{row.city}</span>
                            <span className="shrink-0 font-mono text-ink-muted">
                              {formatCount(row.evaluations)}
                              <span className="ml-2 text-[11px] tabular-nums">
                                {pct < 1 && pct > 0 ? "<1" : pct.toFixed(0)}%
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <ul className="space-y-1.5">
                      {regions.map((row) => {
                        const pct = sharePct(row.evaluations, focusTotal);
                        return (
                          <li key={row.region}>
                            <button
                              type="button"
                              onClick={() => onSelectRegion(row.region)}
                              className="flex w-full items-baseline justify-between gap-3 rounded-md px-1 py-0.5 text-left text-[12px] transition-colors hover:bg-surface"
                            >
                              <span className="min-w-0 truncate font-medium">
                                {row.region}
                              </span>
                              <span className="shrink-0 font-mono text-ink-muted">
                                {formatCount(row.evaluations)}
                                <span className="ml-2 text-[11px] tabular-nums">
                                  {pct < 1 && pct > 0 ? "<1" : pct.toFixed(0)}%
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="pointer-events-auto rounded-2xl border border-line/80 bg-canvas/90 px-3.5 py-2.5 shadow-sm backdrop-blur-sm"
            onMouseEnter={() => {
              setHover(null);
              setRegionHover(null);
              setCityHover(null);
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
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
                      "linear-gradient(90deg, color-mix(in srgb, var(--color-chip-blue) 22%, transparent), color-mix(in srgb, var(--color-chip-blue) 92%, transparent))",
                  }}
                  aria-hidden
                />
                <span className="font-mono text-[10px] text-ink-muted">
                  {formatCount(maxEvals)}
                </span>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export function SeriesChart({
  series,
  hourly,
}: {
  series: { bucket: string; evaluations: number }[];
  hourly: boolean;
}) {
  const data = useMemo(() => {
    const byBucket = new Map(series.map((point) => [point.bucket, point.evaluations]));
    const count = hourly ? 24 : Math.max(series.length, 7);
    const stepMs = hourly ? 3_600_000 : 86_400_000;
    const now = Date.now();
    const points: { label: string; value: number }[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const date = new Date(now - i * stepMs);
      const key = hourly
        ? `${date.toISOString().slice(0, 13).replace("T", " ")}:00:00`
        : date.toISOString().slice(0, 10);
      const label = hourly
        ? `${date.toISOString().slice(11, 13)}:00`
        : date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          });
      points.push({ label, value: byBucket.get(key) ?? 0 });
    }
    return points;
  }, [series, hourly]);

  return (
    <SeriesAreaChart
      data={data}
      label="Evaluations"
      className="aspect-auto h-44 w-full"
    />
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
          const pct = sharePct(row.evaluations, total);
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
                      selected ? "bg-canvas/80" : "bg-chip-blue/85",
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
  compact = false,
}: {
  rows: {
    key: string;
    label: ReactNode;
    title?: string;
    mono: boolean;
    evaluations: number;
  }[];
  total: number;
  /** Narrow sidebar: flexible label, bar under row, no % column. */
  compact?: boolean;
}) {
  const max = Math.max(...rows.map((row) => row.evaluations), 1);
  if (rows.length === 0) {
    return <p className="py-6 text-center text-[13px] text-ink-muted">Nothing here yet.</p>;
  }
  return (
    <div className="min-w-0 space-y-2.5">
      {rows.map((row) => {
        const pct = sharePct(row.evaluations, total);
        const title =
          row.title ?? (typeof row.label === "string" ? row.label : undefined);
        const barWidth = `${Math.max((row.evaluations / max) * 100, 1)}%`;

        if (compact) {
          return (
            <div key={row.key} className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[13px]",
                    row.mono && "font-mono text-[12px]",
                  )}
                  title={title}
                >
                  {row.label}
                </span>
                <span className="shrink-0 font-mono text-[12px] tabular-nums">
                  {formatCount(row.evaluations)}
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-line/60">
                <div
                  className="h-full rounded-full bg-chip-blue/85"
                  style={{ width: barWidth }}
                />
              </div>
            </div>
          );
        }

        return (
          <div key={row.key} className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "w-40 max-w-[40%] shrink-0 truncate text-[13px]",
                row.mono && "font-mono text-[12px]",
              )}
              title={title}
            >
              {row.label}
            </span>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-line/60">
              <div
                className="h-full rounded-full bg-chip-blue/85"
                style={{ width: barWidth }}
              />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-[12px] tabular-nums">
              {formatCount(row.evaluations)}
            </span>
            <span className="w-12 shrink-0 text-right text-[12px] text-ink-muted tabular-nums">
              {pct < 0.1 ? "<0.1" : pct.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Flag,
  Globe,
  MapPin,
  Users,
  BarChart3,
  TrendingUp,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

import type { FeatureFlag } from "@/lib/db/schema"
import type {
  TimeseriesPoint,
  FlagSummaryStats,
  CountryBreakdown,
  GeoPoint,
} from "@/lib/actions/flag-analytics"
import {
  updateFeatureFlag,
  deleteFeatureFlag,
  toggleFeatureFlag,
} from "@/lib/actions/feature-flags"
import {
  Map,
  MapClusterLayer,
  MapControls,
} from "@/components/ui/map"

// ─── Constants ──────────────────────────────────────────────────────────────

const ENVIRONMENTS = ["production", "staging", "development"] as const

const chartConfig = {
  evaluations: {
    label: "Evaluations",
    color: "var(--chart-1)",
  },
  unique_users: {
    label: "Unique Users",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

// ─── Props ──────────────────────────────────────────────────────────────────

interface FlagDetailClientProps {
  flag: FeatureFlag
  timeseries: TimeseriesPoint[]
  summary: FlagSummaryStats
  countries: CountryBreakdown[]
  geoPoints: GeoPoint[]
}

// ─── Component ──────────────────────────────────────────────────────────────

export function FlagDetailClient({
  flag,
  timeseries,
  summary,
  countries,
  geoPoints,
}: FlagDetailClientProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [enabled, setEnabled] = useState(flag.enabled)

  const [formData, setFormData] = useState({
    key: flag.key,
    name: flag.name,
    description: flag.description || "",
    environment: flag.environment,
  })

  // Convert geo points to GeoJSON FeatureCollection for the map cluster layer
  const geoJsonData = useMemo<
    GeoJSON.FeatureCollection<GeoJSON.Point>
  >(() => {
    const features: GeoJSON.Feature<GeoJSON.Point>[] = geoPoints.flatMap(
      (pt) => {
        // Repeat the feature based on evaluation count so clustering reflects volume
        const feature: GeoJSON.Feature<GeoJSON.Point> = {
          type: "Feature",
          properties: {
            city: pt.city,
            country: pt.country,
            evaluations: pt.evaluations,
            unique_users: pt.unique_users,
          },
          geometry: {
            type: "Point",
            coordinates: [pt.longitude, pt.latitude],
          },
        }
        return [feature]
      }
    )
    return { type: "FeatureCollection", features }
  }, [geoPoints])

  const handleSave = async () => {
    if (!formData.key || !formData.name) {
      toast.error("Key and name are required")
      return
    }

    setIsLoading(true)
    try {
      await updateFeatureFlag(flag.id, { ...formData, enabled })
      toast.success("Feature flag updated")
      router.refresh()
    } catch {
      toast.error("Failed to update feature flag")
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggle = async (checked: boolean) => {
    setEnabled(checked)
    try {
      await toggleFeatureFlag(flag.id, checked)
      toast.success(`Flag ${checked ? "enabled" : "disabled"}`)
    } catch {
      setEnabled(!checked) // revert on error
      toast.error("Failed to toggle feature flag")
    }
  }

  const handleDelete = async () => {
    setIsLoading(true)
    try {
      await deleteFeatureFlag(flag.id)
      toast.success("Feature flag deleted")
      router.push("/dashboard/flags")
    } catch {
      toast.error("Failed to delete feature flag")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/flags")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Flag className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">{flag.name}</h1>
                <Badge variant={enabled ? "default" : "muted"}>
                  {enabled ? "Enabled" : "Disabled"}
                </Badge>
                <Badge
                  variant={
                    flag.environment === "production"
                      ? "default"
                      : flag.environment === "staging"
                        ? "muted"
                        : "outline"
                  }
                >
                  {flag.environment}
                </Badge>
              </div>
              <p className="font-mono text-sm text-muted-foreground">
                {flag.key}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={enabled} onCheckedChange={handleToggle} />
          <Button
            variant="destructive"
            size="icon"
            onClick={() => setIsDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Settings Card ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Update the feature flag configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="key">Key</Label>
              <Input
                id="key"
                value={formData.key}
                onChange={(e) =>
                  setFormData({ ...formData, key: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier used in your code
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="environment">Environment</Label>
              <Select
                value={formData.environment}
                onValueChange={(value) =>
                  setFormData({ ...formData, environment: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENVIRONMENTS.map((env) => (
                    <SelectItem key={env} value={env}>
                      {env.charAt(0).toUpperCase() + env.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button variant="primary" onClick={handleSave} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Analytics Section ────────────────────────────────────────── */}
      <Separator />

      <div>
        <h2 className="text-lg font-semibold">Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Evaluation metrics for the last 30 days
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Evaluations
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.total_evaluations.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.unique_users.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Distinct customer IDs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top Country</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.top_country}</div>
            <p className="text-xs text-muted-foreground">
              Most evaluations from
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.avg_daily_evaluations.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Evaluations per day
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Area chart — evaluations over time */}
      <Card>
        <CardHeader>
          <CardTitle>Evaluations Over Time</CardTitle>
          <CardDescription>
            Daily evaluations and unique users over the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {timeseries.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              No evaluation data yet. Data will appear once the SDK starts
              requesting flags.
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <AreaChart
                data={timeseries}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="fillEvaluations"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient
                    id="fillUniqueUsers"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--chart-2)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--chart-2)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(v) =>
                    new Date(v).toLocaleDateString("en", {
                      month: "short",
                      day: "numeric",
                    })
                  }
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(v) =>
                        new Date(v).toLocaleDateString("en", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })
                      }
                    />
                  }
                />
                <Area
                  type="natural"
                  dataKey="evaluations"
                  fill="url(#fillEvaluations)"
                  stroke="var(--chart-1)"
                  stackId="a"
                />
                <Area
                  type="natural"
                  dataKey="unique_users"
                  fill="url(#fillUniqueUsers)"
                  stroke="var(--chart-2)"
                  stackId="b"
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Geographic breakdown — map + table */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Map */}
        <Card className="lg:col-span-3 p-0 overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Geographic Distribution</CardTitle>
            </div>
            <CardDescription>
              Evaluation locations over the last 30 days
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {geoPoints.length === 0 ? (
              <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
                No geographic data yet. Data will appear once the SDK starts
                requesting flags.
              </div>
            ) : (
              <div className="h-[350px]">
                <Map
                  center={[
                    Number.isFinite(geoPoints[0]?.longitude) ? geoPoints[0].longitude : 0,
                    Number.isFinite(geoPoints[0]?.latitude) ? geoPoints[0].latitude : 20,
                  ]}
                  zoom={1.5}
                >
                  <MapClusterLayer
                    data={geoJsonData}
                    clusterRadius={40}
                    clusterMaxZoom={12}
                    clusterColors={["#22c55e", "#eab308", "#ef4444"]}
                    clusterThresholds={[10, 50]}
                    pointColor="#3b82f6"
                  />
                  <MapControls showZoom showFullscreen position="bottom-right" />
                </Map>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Country table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Country Breakdown</CardTitle>
            <CardDescription>
              Top countries (last 30 days)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {countries.length === 0 ? (
              <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
                No geographic data yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Country</TableHead>
                    <TableHead className="text-right">Evaluations</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {countries.map((row) => (
                    <TableRow key={row.country}>
                      <TableCell className="font-medium">{row.country}</TableCell>
                      <TableCell className="text-right">
                        {row.evaluations.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.unique_users.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Delete Confirmation ──────────────────────────────────────── */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Feature Flag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{flag.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

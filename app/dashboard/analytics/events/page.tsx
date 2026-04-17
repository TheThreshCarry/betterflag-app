import { DashboardLayout } from "@/components/dashboard-layout"
import { getOrganizationId } from "@/lib/actions/utils"
import { queryPipe, toIsoDate, daysAgo } from "@/lib/tinybird"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = "force-dynamic"

type TimeseriesRow = {
  ts: string
  event_type: string
  events: number
  uniques: number
}

type TopRow = { url?: string; referrer?: string; views?: number; visits?: number; uniques: number }

export default async function EventsAnalyticsPage() {
  const orgId = await getOrganizationId()

  const from = toIsoDate(daysAgo(7))
  const to = toIsoDate(new Date())

  let timeseries: TimeseriesRow[] = []
  let topPages: TopRow[] = []
  let topReferrers: TopRow[] = []

  if (orgId) {
    try {
      const [ts, pages, refs] = await Promise.all([
        queryPipe<TimeseriesRow>("events_timeseries", {
          organization_id: orgId,
          from,
          to,
          bucket_minutes: 60,
        }),
        queryPipe<TopRow>("events_top_pages", {
          organization_id: orgId,
          from,
          to,
          limit: 10,
        }),
        queryPipe<TopRow>("events_top_referrers", {
          organization_id: orgId,
          from,
          to,
          limit: 10,
        }),
      ])
      timeseries = ts.data
      topPages = pages.data
      topReferrers = refs.data
    } catch {
      // Tinybird not configured yet — render empty state.
    }
  }

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Analytics", href: "/dashboard/analytics" },
        { label: "Events" },
      ]}
    >
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Events</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Pageviews + custom events, last 7 days. Powered by Tinybird.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Timeseries (hourly)</CardTitle>
          </CardHeader>
          <CardContent>
            {timeseries.length === 0 ? (
              <EmptyState label="No events yet" />
            ) : (
              <pre className="text-xs overflow-x-auto">
                {JSON.stringify(timeseries.slice(0, 10), null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Top pages</CardTitle>
            </CardHeader>
            <CardContent>
              {topPages.length === 0 ? (
                <EmptyState label="No pageviews" />
              ) : (
                <ul className="space-y-2 text-sm">
                  {topPages.map((p, i) => (
                    <li
                      key={i}
                      className="flex justify-between gap-4 border-b last:border-0 pb-2"
                    >
                      <span className="truncate">{p.url}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {p.views} views
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top referrers</CardTitle>
            </CardHeader>
            <CardContent>
              {topReferrers.length === 0 ? (
                <EmptyState label="No referrers" />
              ) : (
                <ul className="space-y-2 text-sm">
                  {topReferrers.map((r, i) => (
                    <li
                      key={i}
                      className="flex justify-between gap-4 border-b last:border-0 pb-2"
                    >
                      <span className="truncate">{r.referrer}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {r.visits} visits
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}

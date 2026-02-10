"use client"

import { useEffect, useState } from "react"
import {
  CreditCard,
  Zap,
  BarChart3,
  ExternalLink,
  Crown,
  Loader2,
  ArrowUpRight,
  Receipt,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { authClient } from "@/lib/auth/auth-client"

// ---------------------------------------------------------------------------
// Plan definitions
// ---------------------------------------------------------------------------

const PLANS = {
  free: {
    name: "Free",
    price: "$0",
    period: "/month",
    description: "For individuals and small projects",
    limits: {
      apiCalls: 1_000,
      flags: 5,
      configs: 2,
      changelogs: 1,
    },
  },
  pro: {
    name: "Pro",
    price: "$19",
    period: "/month",
    description: "For growing teams and products",
    limits: {
      apiCalls: 50_000,
      flags: Infinity,
      configs: Infinity,
      changelogs: Infinity,
    },
  },
  team: {
    name: "Team",
    price: "$49",
    period: "/month",
    description: "For teams that need more power",
    limits: {
      apiCalls: 200_000,
      flags: Infinity,
      configs: Infinity,
      changelogs: Infinity,
    },
  },
} as const

type PlanSlug = keyof typeof PLANS

// ---------------------------------------------------------------------------
// Polar Customer State — matches the ACTUAL Polar API response shape.
//
// The `data` returned by `authClient.customer.state()` IS the customer object,
// NOT a wrapper like `{ customer, subscriptions }`.
// ---------------------------------------------------------------------------

interface PolarSubscription {
  id: string
  status: string
  productId: string
  amount: number
  currency: string
  recurringInterval: string
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  canceledAt: string | null
  startedAt: string | null
  endsAt: string | null
  trialStart: string | null
  trialEnd: string | null
}

interface PolarMeter {
  id: string
  meterId: string
  consumedUnits: number
  creditedUnits: number
  balance: number
}

interface PolarCustomerState {
  id: string
  email: string
  name: string | null
  externalId: string
  activeSubscriptions: PolarSubscription[]
  grantedBenefits: unknown[]
  activeMeters: PolarMeter[]
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BillingClientProps {
  productIds: {
    pro: string
    team: string
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectPlan(
  subscriptions: PolarSubscription[],
  productIds: BillingClientProps["productIds"]
): PlanSlug {
  if (!subscriptions || subscriptions.length === 0) return "free"

  const active = subscriptions.find(
    (sub) => sub.status === "active" || sub.status === "trialing"
  )
  if (!active) return "free"

  // Match by product ID from server-provided env vars
  if (active.productId === productIds.team) return "team"
  if (active.productId === productIds.pro) return "pro"

  // Fallback: any active paid subscription is at least "pro"
  return "pro"
}

function formatNumber(num: number): string {
  if (num === Infinity) return "Unlimited"
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`
  return num.toLocaleString()
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A"
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function BillingClient({ productIds }: BillingClientProps) {
  const [customerState, setCustomerState] = useState<PolarCustomerState | null>(null)
  const [customerExists, setCustomerExists] = useState(true)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  useEffect(() => {
    async function fetchState() {
      try {
        const response = await authClient.customer.state()
        // `response.data` IS the customer object directly
        const data = response?.data as unknown as PolarCustomerState | null
        if (data?.id) {
          setCustomerState(data)
          setCustomerExists(true)
        } else {
          setCustomerState(null)
          setCustomerExists(false)
        }
      } catch {
        // Customer doesn't exist in Polar yet — show free tier
        setCustomerState(null)
        setCustomerExists(false)
      } finally {
        setLoading(false)
      }
    }
    fetchState()
  }, [])

  const currentPlan = customerState
    ? detectPlan(customerState.activeSubscriptions, productIds)
    : "free"

  const planDetails = PLANS[currentPlan]

  const activeSubscription = customerState?.activeSubscriptions?.find(
    (sub) => sub.status === "active" || sub.status === "trialing"
  )

  // Find the API calls meter from activeMeters
  const apiCallsMeter = customerState?.activeMeters?.[0]

  const handleCheckout = async (slug: string) => {
    setCheckoutLoading(slug)
    try {
      await authClient.checkout({ slug })
    } catch (error) {
      console.error("Checkout failed:", error)
      toast.error("Failed to start checkout. Please try again.")
    } finally {
      setCheckoutLoading(null)
    }
  }

  const handlePortal = async () => {
    try {
      await authClient.customer.portal()
    } catch (error) {
      console.error("Portal redirect failed:", error)
      toast.error("Failed to open customer portal. Please try again.")
    }
  }

  if (loading) {
    return <BillingSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Info banner for users without a Polar customer record */}
      {!customerExists && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
          You&apos;re on the <strong>Free</strong> plan. Upgrade below to unlock higher limits and premium features.
        </div>
      )}

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Crown className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Current Plan</CardTitle>
                <CardDescription>
                  Manage your subscription and billing
                </CardDescription>
              </div>
            </div>
            <Badge
              variant={currentPlan === "free" ? "secondary" : "default"}
              className="text-sm"
            >
              {planDetails.name}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold">{planDetails.price}</span>
            <span className="text-muted-foreground">{planDetails.period}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {planDetails.description}
          </p>

          {activeSubscription && (
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {activeSubscription.status === "trialing" && activeSubscription.trialEnd && (
                <span>
                  Trial ends on {formatDate(activeSubscription.trialEnd)}
                </span>
              )}
              {activeSubscription.status === "active" && activeSubscription.currentPeriodEnd && (
                <span>
                  {activeSubscription.cancelAtPeriodEnd ? "Expires" : "Renews"}{" "}
                  on {formatDate(activeSubscription.currentPeriodEnd)}
                </span>
              )}
              {activeSubscription.cancelAtPeriodEnd && (
                <Badge variant="outline" className="text-amber-600">
                  Canceling
                </Badge>
              )}
              {activeSubscription.status === "trialing" && (
                <Badge variant="outline" className="text-blue-600">
                  Trial
                </Badge>
              )}
            </div>
          )}

          <Separator className="my-4" />

          <div className="flex flex-wrap gap-3">
            {currentPlan !== "free" && (
              <Button variant="outline" onClick={handlePortal}>
                <CreditCard className="mr-2 h-4 w-4" />
                Manage Subscription
                <ExternalLink className="ml-2 h-3 w-3" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Usage</CardTitle>
              <CardDescription>
                Your current usage this billing period
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <UsageMeter
              label="API Calls"
              used={apiCallsMeter?.consumedUnits ?? 0}
              limit={planDetails.limits.apiCalls}
              icon={<Zap className="h-4 w-4" />}
            />
            <UsageMeter
              label="Feature Flags"
              used={0}
              limit={planDetails.limits.flags}
              icon={<Zap className="h-4 w-4" />}
              note="Count-based limit"
            />
            <UsageMeter
              label="Global Configs"
              used={0}
              limit={planDetails.limits.configs}
              icon={<Zap className="h-4 w-4" />}
              note="Count-based limit"
            />
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ArrowUpRight className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Plans</CardTitle>
              <CardDescription>
                Choose the plan that fits your needs
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {(Object.entries(PLANS) as [PlanSlug, (typeof PLANS)[PlanSlug]][]).map(
              ([slug, plan]) => (
                <div
                  key={slug}
                  className={`relative rounded-lg border p-4 ${
                    currentPlan === slug
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  {currentPlan === slug && (
                    <Badge className="absolute -top-2.5 left-3 text-xs">
                      Current Plan
                    </Badge>
                  )}
                  <div className="mb-3 mt-1">
                    <h3 className="font-semibold">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">{plan.price}</span>
                      <span className="text-sm text-muted-foreground">
                        {plan.period}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {plan.description}
                    </p>
                  </div>
                  <Separator className="my-3" />
                  <ul className="space-y-1.5 text-sm">
                    <li className="flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatNumber(plan.limits.apiCalls)} API calls/mo
                    </li>
                    <li className="flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatNumber(plan.limits.flags)} Feature Flags
                    </li>
                    <li className="flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatNumber(plan.limits.configs)} Global Configs
                    </li>
                    <li className="flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatNumber(plan.limits.changelogs)} Changelogs
                    </li>
                  </ul>
                  <div className="mt-4">
                    {currentPlan === slug ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled
                      >
                        Current Plan
                      </Button>
                    ) : slug === "free" ? (
                      currentPlan !== "free" ? (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={handlePortal}
                        >
                          Downgrade
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full"
                          disabled
                        >
                          Current Plan
                        </Button>
                      )
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => handleCheckout(slug)}
                        disabled={checkoutLoading === slug}
                      >
                        {checkoutLoading === slug ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Redirecting...
                          </>
                        ) : currentPlan !== "free" ? (
                          "Change Plan"
                        ) : (
                          "Upgrade"
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* Order History — only render if customer exists in Polar */}
      {customerExists && <OrderHistory />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function UsageMeter({
  label,
  used,
  limit,
  icon,
  note,
}: {
  label: string
  used: number
  limit: number
  icon: React.ReactNode
  note?: string
}) {
  const percentage = limit === Infinity ? 0 : Math.min((used / limit) * 100, 100)
  const isNearLimit = percentage > 80
  const isOverLimit = percentage >= 100

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{label}</span>
          {note && (
            <span className="text-xs text-muted-foreground">({note})</span>
          )}
        </div>
        <span className="text-muted-foreground">
          {formatNumber(used)} / {formatNumber(limit)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${
            isOverLimit
              ? "bg-destructive"
              : isNearLimit
                ? "bg-amber-500"
                : "bg-primary"
          }`}
          style={{ width: `${limit === Infinity ? 0 : percentage}%` }}
        />
      </div>
    </div>
  )
}

function OrderHistory() {
  const [orders, setOrders] = useState<
    Array<{
      id: string
      createdAt: string
      totalAmount: number
      currency: string
      description: string | null
      product?: { name: string }
    }>
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchOrders() {
      try {
        const response = await authClient.customer.orders.list({
          query: { page: 1, limit: 10 },
        })
        // Polar response shape: { data: { result: { items: [...], pagination: {...} } } }
        const data = response?.data as unknown as Record<string, unknown>
        const result = data?.result as Record<string, unknown> | undefined
        const items = Array.isArray(result?.items) ? result.items : []
        setOrders(items as typeof orders)
      } catch {
        // Silently fail — customer may not have orders yet
      } finally {
        setLoading(false)
      }
    }
    fetchOrders()
  }, [])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Order History</CardTitle>
            <CardDescription>
              Your recent orders and payments
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Receipt className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              No orders yet
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {order.product?.name ?? order.description ?? "Payment"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(order.createdAt)}
                  </p>
                </div>
                <span className="text-sm font-medium">
                  ${((order.totalAmount ?? 0) / 100).toFixed(2)}{" "}
                  {order.currency?.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function BillingSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="mt-2 h-4 w-64" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

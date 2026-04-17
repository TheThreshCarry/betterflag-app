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
  Check,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { getBillingState, listBillingOrders } from "@/lib/actions/billing"

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
      mediaMaxFileSize: 5 * 1024 * 1024,
      mediaStorage: 100 * 1024 * 1024,
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
      mediaMaxFileSize: 100 * 1024 * 1024,
      mediaStorage: 10 * 1024 * 1024 * 1024,
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
      mediaMaxFileSize: 100 * 1024 * 1024,
      mediaStorage: 50 * 1024 * 1024 * 1024,
    },
  },
} as const

type PlanSlug = keyof typeof PLANS

// ---------------------------------------------------------------------------
// Polar Customer State — local shape for the UI. We resolve billing state from
// our own Supabase `subscriptions` table (populated by webhooks), NOT a live
// round-trip to Polar.
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

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(0)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
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
        const state = await getBillingState()
        if (!state.polarCustomerId) {
          setCustomerState(null)
          setCustomerExists(false)
          return
        }
        const planProductId =
          state.plan === "team"
            ? productIds.team
            : state.plan === "pro"
              ? productIds.pro
              : ""
        const subs: PolarSubscription[] =
          state.plan === "free"
            ? []
            : [
                {
                  id: state.polarCustomerId,
                  status: state.status === "none" ? "active" : state.status,
                  productId: planProductId,
                  amount: 0,
                  currency: "USD",
                  recurringInterval: "month",
                  currentPeriodStart: null,
                  currentPeriodEnd: state.currentPeriodEnd,
                  cancelAtPeriodEnd: state.cancelAtPeriodEnd,
                  canceledAt: null,
                  startedAt: null,
                  endsAt: null,
                  trialStart: null,
                  trialEnd: null,
                },
              ]
        setCustomerState({
          id: state.polarCustomerId,
          email: "",
          name: null,
          externalId: "",
          activeSubscriptions: subs,
          grantedBenefits: [],
          activeMeters: [],
        })
        setCustomerExists(true)
      } catch {
        setCustomerState(null)
        setCustomerExists(false)
      } finally {
        setLoading(false)
      }
    }
    fetchState()
  }, [productIds.pro, productIds.team])

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
      const productId =
        slug === "team" ? productIds.team : slug === "pro" ? productIds.pro : ""
      if (!productId) {
        toast.error("No product configured for this plan.")
        setCheckoutLoading(null)
        return
      }
      window.location.href = `/api/billing/checkout?products=${encodeURIComponent(productId)}`
    } catch (error) {
      console.error("Checkout failed:", error)
      toast.error("Failed to start checkout. Please try again.")
      setCheckoutLoading(null)
    }
  }

  const handlePortal = () => {
    try {
      window.location.href = "/api/billing/portal"
    } catch (error) {
      console.error("Portal redirect failed:", error)
      toast.error("Failed to open customer portal. Please try again.")
    }
  }

  if (loading) {
    return <BillingSkeleton />
  }

  return (
    <div className="space-y-12">
      {/* Info banner for users without a Polar customer record */}
      {!customerExists && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
          You&apos;re on the <strong>Free</strong> plan. Upgrade below to unlock higher limits and premium features.
        </div>
      )}

      {/* Current Plan */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Current Plan</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your subscription and billing
            </p>
          </div>
          <Badge
            variant={currentPlan === "free" ? "muted" : "default"}
            className="text-sm font-normal"
          >
            {planDetails.name}
          </Badge>
        </div>
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold">{planDetails.price}</span>
            <span className="text-muted-foreground">{planDetails.period}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {planDetails.description}
          </p>

          {activeSubscription && (
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground bg-muted/30 p-3 rounded-md border inline-flex">
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
                <Badge variant="outline" className="text-amber-600 bg-amber-50">
                  Canceling
                </Badge>
              )}
              {activeSubscription.status === "trialing" && (
                <Badge variant="outline" className="text-blue-600 bg-blue-50">
                  Trial
                </Badge>
              )}
            </div>
          )}

          {currentPlan !== "free" && (
            <div className="mt-6">
              <Button variant="outline" onClick={handlePortal}>
                <CreditCard className="mr-2 h-4 w-4" />
                Manage Subscription
                <ExternalLink className="ml-2 h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Usage Overview */}
      <div className="space-y-6 pt-6 border-t">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Usage</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Your current usage this billing period
            </p>
          </div>
        </div>
        <div className="space-y-6 max-w-2xl">
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
      </div>

      {/* Available Plans */}
      <div className="space-y-6 pt-6 border-t">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Plans</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose the plan that fits your needs
            </p>
          </div>
        </div>
        <div>
          <div className="grid gap-6 md:grid-cols-3">
            {(Object.entries(PLANS) as [PlanSlug, (typeof PLANS)[PlanSlug]][]).map(
              ([slug, plan]) => (
                <div
                  key={slug}
                  className={`relative rounded-xl border p-6 flex flex-col ${
                    currentPlan === slug
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "bg-card"
                  }`}
                >
                  {currentPlan === slug && (
                    <Badge className="absolute -top-3 right-6 text-xs font-normal px-3 py-0.5">
                      Current Plan
                    </Badge>
                  )}
                  <div className="mb-4 mt-1">
                    <h3 className="font-medium text-lg">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-3xl font-bold">{plan.price}</span>
                      <span className="text-sm text-muted-foreground">
                        {plan.period}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {plan.description}
                    </p>
                  </div>
                  <div className="my-6 border-t border-border/50" />
                  <ul className="space-y-3 text-sm flex-1">
                    <li className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      <span>{formatNumber(plan.limits.apiCalls)} API calls/mo</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      <span>{formatNumber(plan.limits.flags)} Feature Flags</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      <span>{formatNumber(plan.limits.configs)} Global Configs</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      <span>{formatNumber(plan.limits.changelogs)} Changelogs</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      <span>{formatBytes(plan.limits.mediaStorage)} Media Storage</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      <span>{formatBytes(plan.limits.mediaMaxFileSize)} max upload</span>
                    </li>
                  </ul>
                  <div className="mt-8 pt-4">
                    {currentPlan === slug ? (
                      <Button
                        variant="outline"
                        className="w-full bg-background/50"
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
                        variant="primary"
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
        </div>
      </div>

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
        const rows = await listBillingOrders(10)
        setOrders(
          rows.map((o) => ({
            id: o.id,
            createdAt: o.createdAt,
            totalAmount: o.amount,
            currency: o.currency,
            description: null,
            product: o.productName ? { name: o.productName } : undefined,
          })),
        )
      } catch {
        // Silently fail — customer may not have orders yet
      } finally {
        setLoading(false)
      }
    }
    fetchOrders()
  }, [])

  return (
    <div className="space-y-6 pt-6 border-t">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Order History</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Your recent orders and payments
          </p>
        </div>
      </div>
      <div>
        {loading ? (
          <div className="space-y-3 max-w-3xl">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center max-w-3xl border rounded-lg border-dashed">
            <Receipt className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No orders yet
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-w-3xl">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">
                    {order.product?.name ?? order.description ?? "Payment"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
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
      </div>
    </div>
  )
}

function BillingSkeleton() {
  return (
    <div className="space-y-12">
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-12 w-32" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-10 w-48 mt-6" />
        </div>
      </div>
      
      <div className="space-y-6 pt-6 border-t">
        <div className="flex items-center justify-between border-b pb-4">
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="space-y-6 max-w-2xl">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  )
}

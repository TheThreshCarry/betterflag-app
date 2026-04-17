"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import type { SchemaChange } from "@/lib/cms/types"
import {
  groupChangesBySeverity,
  hasDestructiveChanges,
} from "@/lib/cms/schema-diff"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
  ShieldAlert,
  Loader2,
  Trash2,
  Plus,
  Pencil,
  ArrowUpDown,
  Settings,
} from "lucide-react"

interface SchemaMigrationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  changes: SchemaChange[]
  onConfirm: () => void
  confirming?: boolean
}

const HOLD_DURATION = 5000

const changeActionIcon: Record<string, React.ReactNode> = {
  add: <Plus className="h-3.5 w-3.5" />,
  remove: <Trash2 className="h-3.5 w-3.5" />,
  typeChange: <Pencil className="h-3.5 w-3.5" />,
  reorder: <ArrowUpDown className="h-3.5 w-3.5" />,
  validationChange: <Settings className="h-3.5 w-3.5" />,
  configChange: <Settings className="h-3.5 w-3.5" />,
}

function severityBadge(severity: SchemaChange["severity"]) {
  switch (severity) {
    case "safe":
      return (
        <Badge variant="muted" className="text-xs">
          Safe
        </Badge>
      )
    case "risky":
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs">
          Risky
        </Badge>
      )
    case "destructive":
      return (
        <Badge variant="destructive" className="text-xs">
          Destructive
        </Badge>
      )
  }
}

function ChangeItem({ change }: { change: SchemaChange }) {
  return (
    <div className="flex items-start gap-2 text-sm py-1.5">
      <span className="mt-0.5 shrink-0">
        {changeActionIcon[change.action] ?? <Settings className="h-3.5 w-3.5" />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{change.field ?? "Schema"}</span>
          {severityBadge(change.severity)}
        </div>
        {change.warning && (
          <p className="text-muted-foreground text-xs mt-0.5">{change.warning}</p>
        )}
      </div>
    </div>
  )
}

export function SchemaMigrationDialog({
  open,
  onOpenChange,
  changes,
  onConfirm,
  confirming = false,
}: SchemaMigrationDialogProps) {
  const grouped = groupChangesBySeverity(changes)
  const isDestructive = hasDestructiveChanges(changes)

  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const countdownRef = useRef<HTMLSpanElement>(null)
  const [holding, setHolding] = useState(false)

  const cancelHold = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    startTimeRef.current = null
    setHolding(false)
    if (progressBarRef.current) {
      progressBarRef.current.style.width = "0%"
    }
    if (countdownRef.current) {
      countdownRef.current.textContent = `Hold to accept (${(HOLD_DURATION / 1000).toFixed(1)}s remaining)`
    }
  }, [])

  const tick = useCallback(() => {
    if (startTimeRef.current === null) return

    const elapsed = Date.now() - startTimeRef.current
    const progress = Math.min(elapsed / HOLD_DURATION, 1)

    if (progressBarRef.current) {
      progressBarRef.current.style.width = `${progress * 100}%`
    }

    if (countdownRef.current) {
      const remaining = Math.max(0, (HOLD_DURATION - elapsed) / 1000)
      countdownRef.current.textContent = `Hold to accept (${remaining.toFixed(1)}s remaining)`
    }

    if (progress >= 1) {
      rafRef.current = null
      startTimeRef.current = null
      onConfirm()
      return
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [onConfirm])

  const startHold = useCallback(() => {
    if (confirming) return
    startTimeRef.current = Date.now()
    setHolding(true)
    rafRef.current = requestAnimationFrame(tick)
  }, [confirming, tick])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  // Safe mode: auto-close, no dialog needed
  useEffect(() => {
    if (open && changes.length > 0 && !isDestructive && grouped.risky.length === 0) {
      onConfirm()
      onOpenChange(false)
    }
  }, [open, changes, isDestructive, grouped.risky.length, onConfirm, onOpenChange])

  // Don't render dialog for safe-only changes
  if (!isDestructive && grouped.risky.length === 0) {
    return null
  }

  // ── DESTRUCTIVE MODE ──────────────────────────────────────────────
  if (isDestructive) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              DESTRUCTIVE CHANGE DETECTED
            </DialogTitle>
            <DialogDescription>
              Review the following changes carefully before proceeding.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Risky changes (if any) */}
            {grouped.risky.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-1.5 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  Risky Changes
                </p>
                <div className="pl-1">
                  {grouped.risky.map((change, i) => (
                    <ChangeItem key={`risky-${i}`} change={change} />
                  ))}
                </div>
              </div>
            )}

            {/* Safe changes summary */}
            {grouped.safe.length > 0 && (
              <p className="text-xs text-muted-foreground">
                + {grouped.safe.length} safe change{grouped.safe.length !== 1 ? "s" : ""}
              </p>
            )}

            {/* Destructive section */}
            <div className="rounded-md border-2 border-destructive bg-destructive/5 p-3 space-y-2">
              {grouped.destructive.map((change, i) => (
                <div
                  key={`destructive-${i}`}
                  className="flex items-start gap-2 text-sm text-destructive"
                >
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium">{change.field ?? "Schema"}</span>
                    {change.warning && (
                      <p className="text-xs mt-0.5 opacity-80">{change.warning}</p>
                    )}
                  </div>
                </div>
              ))}
              <p className="text-xs font-semibold text-destructive pt-1">
                This action CANNOT be undone.
              </p>
            </div>

            {/* Hold-to-confirm button */}
            <div
              role="button"
              tabIndex={0}
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              className={`
                relative overflow-hidden select-none cursor-pointer
                rounded-lg border-2 p-4 text-center font-medium transition-colors
                ${
                  holding
                    ? "border-destructive bg-destructive text-destructive-foreground"
                    : "border-destructive bg-destructive/10 text-destructive"
                }
              `}
            >
              {/* Progress bar fill */}
              <div
                ref={progressBarRef}
                className="absolute bottom-0 left-0 h-full bg-destructive/30 transition-none"
                style={{ width: "0%" }}
              />

              {/* Label */}
              <span className="relative z-10 flex items-center justify-center gap-2">
                {confirming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Applying changes…
                  </>
                ) : (
                  <span ref={countdownRef}>
                    Hold to accept ({(HOLD_DURATION / 1000).toFixed(1)}s remaining)
                  </span>
                )}
              </span>
            </div>
          </div>

          <DialogFooter className="sm:justify-start">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // ── RISKY MODE (no destructive) ───────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Schema Changes Require Confirmation
          </DialogTitle>
          <DialogDescription>
            The following changes will be applied to your schema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Safe changes summary */}
          {grouped.safe.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {grouped.safe.length} safe change{grouped.safe.length !== 1 ? "s" : ""} (auto-applied)
              </p>
            </div>
          )}

          {/* Risky changes list */}
          {grouped.risky.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium flex items-center gap-1.5 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                Changes requiring confirmation
              </p>
              <div className="rounded-md border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 p-2">
                {grouped.risky.map((change, i) => (
                  <ChangeItem key={`risky-${i}`} change={change} />
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={confirming}>
            {confirming && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Accept Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

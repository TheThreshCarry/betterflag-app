"use client"

import { Button } from "@/components/ui/button"
import { AlertTriangle, Loader2 } from "lucide-react"

interface SchemaLegacyBannerProps {
  onUpgrade: () => void
  upgrading?: boolean
}

export function SchemaLegacyBanner({
  onUpgrade,
  upgrading = false,
}: SchemaLegacyBannerProps) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            This content type uses a legacy schema format.
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-300/80">
            Upgrade to the visual schema builder to manage fields easily.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onUpgrade}
            disabled={upgrading}
            className="border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/30"
          >
            {upgrading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Upgrade to Visual Builder
          </Button>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { ArrowRight, Check, Loader2, PartyPopper, SkipForward } from "lucide-react"
import { motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { ONBOARDING_MODULES } from "../module-configs"

interface CompletionStepProps {
  selectedModules: string[]
  createdItems: Record<string, boolean>
  onGoToDashboard: () => void | Promise<void>
}

// Confetti-style floating particles
function Confetti() {
  const colors = [
    "bg-primary",
    "bg-blue-500",
    "bg-green-500",
    "bg-yellow-500",
    "bg-pink-500",
    "bg-purple-500",
  ]

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 24 }).map((_, i) => {
        const left = Math.random() * 100
        const delay = Math.random() * 0.8
        const duration = 2 + Math.random() * 2
        const size = 4 + Math.random() * 6
        const color = colors[i % colors.length]

        return (
          <motion.div
            key={i}
            className={`absolute rounded-full ${color}`}
            style={{
              left: `${left}%`,
              width: size,
              height: size,
              top: -10,
            }}
            initial={{ y: -10, opacity: 1, rotate: 0 }}
            animate={{
              y: [0, 400 + Math.random() * 200],
              opacity: [1, 1, 0],
              rotate: Math.random() * 720 - 360,
              x: [0, (Math.random() - 0.5) * 100],
            }}
            transition={{
              duration,
              delay,
              ease: "easeOut",
            }}
          />
        )
      })}
    </div>
  )
}

export function CompletionStep({
  selectedModules,
  createdItems,
  onGoToDashboard,
}: CompletionStepProps) {
  const [isNavigating, setIsNavigating] = useState(false)

  const handleClick = async () => {
    setIsNavigating(true)
    await onGoToDashboard()
  }

  // Build summary items
  const setupModules = selectedModules
    .map((id) => {
      const config = ONBOARDING_MODULES.find((m) => m.id === id)
      if (!config) return null
      return {
        ...config,
        wasCreated: createdItems[id] === true,
        wasSkipped: createdItems[id] === false,
      }
    })
    .filter(Boolean) as Array<
    (typeof ONBOARDING_MODULES)[number] & {
      wasCreated: boolean
      wasSkipped: boolean
    }
  >

  const createdCount = Object.values(createdItems).filter(Boolean).length
  const skippedCount =
    Object.values(createdItems).filter((v) => v === false).length

  return (
    <div className="relative overflow-hidden">
      <Confetti />

      <div className="relative z-10 text-center mb-8">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
            delay: 0.1,
          }}
          className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"
        >
          <PartyPopper className="size-8" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h1 className="text-2xl font-semibold tracking-tight">You&apos;re all set!</h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <p className="text-sm text-muted-foreground mx-auto max-w-sm mt-2">
            Your workspace is ready. Head to the dashboard to start building.
          </p>
        </motion.div>
      </div>

      <div className="relative z-10">
        {/* Summary */}
        {setupModules.length > 0 && (
          <motion.div
            className="mb-8 space-y-2"
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: { staggerChildren: 0.06, delayChildren: 0.55 },
              },
            }}
          >
            <p className="mb-3 text-center text-sm font-medium text-muted-foreground">
              Setup summary
            </p>
            <div className="mx-auto max-w-sm space-y-1.5">
              {setupModules.map((mod) => {
                const Icon = mod.icon
                return (
                  <motion.div
                    key={mod.id}
                    variants={{
                      hidden: { opacity: 0, x: -10 },
                      show: { opacity: 1, x: 0 },
                    }}
                    className="flex items-center gap-3 rounded-lg border bg-background/60 px-3 py-2"
                  >
                    <div className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="size-3.5" />
                    </div>
                    <span className="flex-1 text-sm">{mod.title}</span>
                    {mod.wasCreated ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <Check className="size-3" />
                        Created
                      </span>
                    ) : mod.wasSkipped ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <SkipForward className="size-3" />
                        Skipped
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Selected
                      </span>
                    )}
                  </motion.div>
                )
              })}
            </div>

            {(createdCount > 0 || skippedCount > 0) && (
              <motion.p
                variants={{
                  hidden: { opacity: 0 },
                  show: { opacity: 1 },
                  transition: { delay: 0.7 },
                }}
                className="pt-2 text-center text-xs text-muted-foreground"
              >
                {createdCount > 0 &&
                  `${createdCount} item${createdCount > 1 ? "s" : ""} created`}
                {createdCount > 0 && skippedCount > 0 && " · "}
                {skippedCount > 0 &&
                  `${skippedCount} skipped`}
              </motion.p>
            )}
          </motion.div>
        )}

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Button
            onClick={handleClick}
            disabled={isNavigating}
            className="w-full gap-2 h-11"
            size="lg"
          >
            {isNavigating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Taking you there...
              </>
            ) : (
              <>
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  )
}

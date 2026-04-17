"use client"

import { useState } from "react"
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ONBOARDING_MODULES, type ModuleConfig } from "../module-configs"

interface ProductPickerStepProps {
  onSelect: (route: string) => Promise<void>
  onBack?: () => void
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export function ProductPickerStep({ onSelect, onBack }: ProductPickerStepProps) {
  const [selecting, setSelecting] = useState<string | null>(null)

  const availableModules = ONBOARDING_MODULES.filter((m) => !m.comingSoon && m.route)
  const comingSoonModules = ONBOARDING_MODULES.filter((m) => m.comingSoon)

  const handleSelect = async (module: ModuleConfig) => {
    if (!module.route || selecting) return
    setSelecting(module.id)
    await onSelect(module.route)
  }

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          What do you want to start with?
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Pick a product and we&apos;ll take you straight there.
        </p>
      </div>

      <motion.div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {availableModules.map((module) => (
          <ProductCard
            key={module.id}
            module={module}
            isLoading={selecting === module.id}
            disabled={!!selecting}
            onSelect={() => handleSelect(module)}
          />
        ))}

        {comingSoonModules.map((module) => (
          <ProductCard
            key={module.id}
            module={module}
            isLoading={false}
            disabled
            onSelect={() => {}}
          />
        ))}
      </motion.div>

      {onBack && (
        <div className="mt-8">
          <Button
            variant="outline"
            onClick={onBack}
            disabled={!!selecting}
            className="gap-2 h-11"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      )}
    </div>
  )
}

function ProductCard({
  module,
  isLoading,
  disabled,
  onSelect,
}: {
  module: ModuleConfig
  isLoading: boolean
  disabled: boolean
  onSelect: () => void
}) {
  const Icon = module.icon

  return (
    <motion.button
      type="button"
      variants={itemVariants}
      whileHover={disabled ? undefined : { scale: 1.03 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      className={cn(
        "group relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-colors",
        isLoading
          ? "border-primary bg-primary/5"
          : disabled
            ? "cursor-not-allowed opacity-50 border-transparent bg-muted/50"
            : "border-transparent bg-muted/50 cursor-pointer hover:border-primary/50 hover:bg-primary/5"
      )}
    >
      {module.comingSoon && (
        <Badge
          variant="secondary"
          className="absolute right-2 top-2 text-[10px]"
        >
          Soon
        </Badge>
      )}

      {isLoading ? (
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-lg transition-colors",
            "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
          )}
        >
          <Icon className="size-5" />
        </div>
      )}

      <span className="text-sm font-medium leading-tight">{module.title}</span>

      <span className="text-[11px] leading-snug text-muted-foreground line-clamp-2">
        {module.description}
      </span>

      {!module.comingSoon && !disabled && (
        <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          Start here
          <ArrowRight className="size-3" />
        </span>
      )}
    </motion.button>
  )
}

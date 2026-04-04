"use client"

import { useState } from "react"
import { ArrowRight, ArrowLeft, Check } from "lucide-react"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ONBOARDING_MODULES, type ModuleConfig } from "../module-configs"

interface ModuleSelectionStepProps {
  onContinue: (selectedModules: string[]) => void
  onBack?: () => void
  initialSelection?: string[]
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export function ModuleSelectionStep({
  onContinue,
  onBack,
  initialSelection = [],
}: ModuleSelectionStepProps) {
  const selectableModules = ONBOARDING_MODULES.filter((m) => !m.comingSoon)
  const comingSoonModules = ONBOARDING_MODULES.filter((m) => m.comingSoon)

  const [selected, setSelected] = useState<string[]>(
    initialSelection.length > 0
      ? initialSelection
      : selectableModules.map((m) => m.id) // All selected by default
  )

  const toggleModule = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const selectAll = () => {
    setSelected(selectableModules.map((m) => m.id))
  }

  const deselectAll = () => {
    setSelected([])
  }

  const allSelected = selectableModules.every((m) => selected.includes(m.id))

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Choose your modules</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Select the modules you want to explore. You can always enable more
          later.
        </p>
        <div className="flex justify-center gap-2 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={allSelected ? deselectAll : selectAll}
            className="text-xs"
          >
            {allSelected ? "Deselect All" : "Select All"}
          </Button>
        </div>
      </div>
      <div>
        <motion.div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {selectableModules.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              isSelected={selected.includes(module.id)}
              onToggle={() => toggleModule(module.id)}
            />
          ))}

          {comingSoonModules.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              isSelected={false}
              onToggle={() => {}}
              disabled
            />
          ))}
        </motion.div>

        <div className="mt-8 flex items-center gap-3">
          {onBack && (
            <Button variant="outline" onClick={onBack} className="gap-2 h-11">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          <Button
            onClick={() => onContinue(selected)}
            className="flex-1 gap-2 h-11"
            size="lg"
            disabled={selected.length === 0}
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Module Card
// ---------------------------------------------------------------------------

function ModuleCard({
  module,
  isSelected,
  onToggle,
  disabled,
}: {
  module: ModuleConfig
  isSelected: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  const Icon = module.icon

  return (
    <motion.button
      type="button"
      variants={itemVariants}
      whileHover={disabled ? undefined : { scale: 1.03 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={disabled ? undefined : onToggle}
      disabled={disabled}
      className={cn(
        "relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-colors",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-transparent bg-muted/50",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer hover:bg-accent/50"
      )}
    >
      {/* Check indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <Check className="size-3" />
        </motion.div>
      )}

      {/* Coming soon badge */}
      {module.comingSoon && (
        <Badge
          variant="secondary"
          className="absolute right-2 top-2 text-[10px]"
        >
          Soon
        </Badge>
      )}

      <div
        className={cn(
          "flex size-10 items-center justify-center rounded-lg",
          isSelected
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-5" />
      </div>

      <span className="text-sm font-medium leading-tight">{module.title}</span>

      <span className="text-[11px] leading-snug text-muted-foreground line-clamp-2">
        {module.description}
      </span>
    </motion.button>
  )
}

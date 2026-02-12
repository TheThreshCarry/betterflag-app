"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { GalleryVerticalEnd } from "lucide-react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"

import { OnboardingForm } from "./onboarding-form"
import { ModuleSelectionStep } from "./steps/module-selection-step"
import { ModuleSetupStep } from "./steps/module-setup-step"
import { CompletionStep } from "./steps/completion-step"
import { ONBOARDING_MODULES, type ModuleConfig } from "./module-configs"
import { authClient } from "@/lib/auth/auth-client"

type WizardStep = "create-org" | "select-modules" | "module-setup" | "complete"

interface OnboardingWizardProps {
  userName: string
  initialStep?: WizardStep
  organizationId?: string
}

const STEP_LABELS = [
  { key: "create-org", label: "Organization" },
  { key: "select-modules", label: "Modules" },
  { key: "module-setup", label: "Setup" },
  { key: "complete", label: "Done" },
] as const

export function OnboardingWizard({
  userName,
  initialStep = "create-org",
  organizationId: initialOrgId,
}: OnboardingWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<WizardStep>(initialStep)
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0)
  const [createdItems, setCreatedItems] = useState<Record<string, boolean>>({})
  const [direction, setDirection] = useState(1) // 1 = forward, -1 = back
  const [orgId, setOrgId] = useState<string | undefined>(initialOrgId)
  const [orgDescription, setOrgDescription] = useState("")

  const currentStepIndex = STEP_LABELS.findIndex((s) => s.key === currentStep)

  const goForward = useCallback((step: WizardStep) => {
    setDirection(1)
    setCurrentStep(step)
  }, [])

  const goBack = useCallback((step: WizardStep) => {
    setDirection(-1)
    setCurrentStep(step)
  }, [])

  // Step 1: Org created
  const handleOrgCreated = useCallback(
    (newOrgId: string, description: string) => {
      setOrgId(newOrgId)
      setOrgDescription(description)
      goForward("select-modules")
    },
    [goForward]
  )

  // Step 2: Modules selected
  const handleModulesSelected = useCallback(
    async (modules: string[]) => {
      setSelectedModules(modules)

      // Save selected modules to org metadata (preserve description)
      if (orgId) {
        try {
          await authClient.organization.update({
            data: {
              metadata: JSON.stringify({
                description: orgDescription || undefined,
                selectedModules: modules,
                onboardingCompleted: false,
              }),
            },
            organizationId: orgId,
          })
        } catch {
          // Non-critical, continue anyway
        }
      }

      // Find the first module that has setup
      const setupModules = modules.filter((id) => {
        const config = ONBOARDING_MODULES.find((m) => m.id === id)
        return config?.hasSetup
      })

      if (setupModules.length > 0) {
        setCurrentModuleIndex(0)
        goForward("module-setup")
      } else {
        goForward("complete")
      }
    },
    [orgId, orgDescription, goForward]
  )

  // Get the list of modules that need setup (in order)
  const setupModules: ModuleConfig[] = selectedModules
    .map((id) => ONBOARDING_MODULES.find((m) => m.id === id))
    .filter((m): m is ModuleConfig => !!m && m.hasSetup)

  // Step 3: Module setup completed/skipped
  const handleModuleComplete = useCallback(
    (moduleId: string, created: boolean) => {
      setCreatedItems((prev) => ({ ...prev, [moduleId]: created }))

      const nextIndex = currentModuleIndex + 1
      if (nextIndex < setupModules.length) {
        setDirection(1)
        setCurrentModuleIndex(nextIndex)
      } else {
        goForward("complete")
      }
    },
    [currentModuleIndex, setupModules.length, goForward]
  )

  const handleModuleBack = useCallback(() => {
    if (currentModuleIndex > 0) {
      setDirection(-1)
      setCurrentModuleIndex(currentModuleIndex - 1)
    } else {
      goBack("select-modules")
    }
  }, [currentModuleIndex, goBack])

  // Completion: mark onboarding as done
  const handleGoToDashboard = useCallback(async () => {
    if (orgId) {
      try {
        await authClient.organization.update({
          data: {
            metadata: JSON.stringify({
              description: orgDescription || undefined,
              selectedModules,
              onboardingCompleted: true,
            }),
          },
          organizationId: orgId,
        })
      } catch {
        // Non-critical
      }
    }
    router.push("/dashboard")
  }, [orgId, orgDescription, selectedModules, router])

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 80 : -80,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -80 : 80,
      opacity: 0,
    }),
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 self-center font-medium"
        >
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GalleryVerticalEnd className="size-4" />
          </div>
          ShipOS
        </Link>

        {/* Progress indicator */}
        <ProgressBar
          steps={STEP_LABELS}
          currentIndex={currentStepIndex}
          moduleProgress={
            currentStep === "module-setup" && setupModules.length > 0
              ? {
                  current: currentModuleIndex + 1,
                  total: setupModules.length,
                }
              : undefined
          }
        />

        {/* Step content */}
        <AnimatePresence mode="wait" custom={direction}>
          {currentStep === "create-org" && (
            <motion.div
              key="create-org"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <OnboardingForm
                userName={userName}
                onOrgCreated={handleOrgCreated}
              />
            </motion.div>
          )}

          {currentStep === "select-modules" && (
            <motion.div
              key="select-modules"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <ModuleSelectionStep
                onContinue={handleModulesSelected}
                onBack={
                  initialStep === "create-org"
                    ? () => goBack("create-org")
                    : undefined
                }
                initialSelection={selectedModules}
              />
            </motion.div>
          )}

          {currentStep === "module-setup" && setupModules[currentModuleIndex] && (
            <motion.div
              key={`module-setup-${setupModules[currentModuleIndex].id}`}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <ModuleSetupStep
                module={setupModules[currentModuleIndex]}
                stepNumber={currentModuleIndex + 1}
                totalSteps={setupModules.length}
                onComplete={handleModuleComplete}
                onBack={handleModuleBack}
              />
            </motion.div>
          )}

          {currentStep === "complete" && (
            <motion.div
              key="complete"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <CompletionStep
                selectedModules={selectedModules}
                createdItems={createdItems}
                onGoToDashboard={handleGoToDashboard}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Progress Bar
// ---------------------------------------------------------------------------

function ProgressBar({
  steps,
  currentIndex,
  moduleProgress,
}: {
  steps: readonly { key: string; label: string }[]
  currentIndex: number
  moduleProgress?: { current: number; total: number }
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, i) => {
        const isActive = i === currentIndex
        const isCompleted = i < currentIndex

        return (
          <div key={step.key} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div className="relative flex items-center justify-center">
                <motion.div
                  className={`flex size-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    isCompleted
                      ? "bg-primary text-primary-foreground"
                      : isActive
                        ? "border-2 border-primary bg-background text-primary"
                        : "border border-muted-foreground/30 bg-background text-muted-foreground"
                  }`}
                  animate={{
                    scale: isActive ? 1.1 : 1,
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                  {isCompleted ? (
                    <motion.svg
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="size-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </motion.svg>
                  ) : (
                    i + 1
                  )}
                </motion.div>
              </div>
              <span
                className={`text-[10px] font-medium ${
                  isActive
                    ? "text-primary"
                    : isCompleted
                      ? "text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {step.label}
                {step.key === "module-setup" &&
                  isActive &&
                  moduleProgress &&
                  ` (${moduleProgress.current}/${moduleProgress.total})`}
              </span>
            </div>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className="mb-4 h-px w-8 sm:w-12">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: isCompleted ? 1 : 0 }}
                  style={{ originX: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
                <div className="-mt-px h-px w-full bg-muted-foreground/20" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { GalleryVerticalEnd } from "lucide-react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"

import { OnboardingForm } from "./onboarding-form"
import { ProductPickerStep } from "./steps/product-picker-step"
import { createClient } from "@/lib/supabase/client"
import { updateOrganization } from "@/lib/actions/organizations"

type WizardStep = "create-org" | "pick-product"

interface OnboardingWizardProps {
  userName: string
  initialStep?: WizardStep
  organizationId?: string
}

export function OnboardingWizard({
  userName,
  initialStep = "create-org",
  organizationId: initialOrgId,
}: OnboardingWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<WizardStep>(initialStep)
  const [direction, setDirection] = useState(1)
  const [orgId, setOrgId] = useState<string | undefined>(initialOrgId)
  const [orgDescription, setOrgDescription] = useState("")

  const handleOrgCreated = useCallback(
    (newOrgId: string, description: string) => {
      setOrgId(newOrgId)
      setOrgDescription(description)
      setDirection(1)
      setCurrentStep("pick-product")
    },
    []
  )

  const handleProductSelected = useCallback(
    async (route: string) => {
      if (orgId) {
        try {
          await updateOrganization({
            organizationId: orgId,
            metadata: {
              description: orgDescription || undefined,
              onboardingCompleted: true,
            },
          })
        } catch {
          // Non-critical
        }
      }
      const supabase = createClient()
      await supabase.auth.refreshSession()
      router.refresh()
      router.push(route)
    },
    [orgId, orgDescription, router]
  )

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
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

        {/* Step dots */}
        <div className="flex items-center justify-center gap-2">
          {(["create-org", "pick-product"] as WizardStep[]).map((step, i) => {
            const stepIndex = currentStep === "create-org" ? 0 : 1
            const isActive = i === stepIndex
            const isCompleted = i < stepIndex
            return (
              <div key={step} className="flex items-center gap-2">
                <motion.div
                  className={`flex size-2 rounded-full transition-colors ${
                    isCompleted || isActive
                      ? "bg-primary"
                      : "bg-muted-foreground/30"
                  }`}
                  animate={{ scale: isActive ? 1.4 : 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
                {i < 1 && (
                  <div className="relative h-px w-8 bg-muted-foreground/20">
                    <motion.div
                      className="absolute inset-0 rounded-full bg-primary"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: isCompleted ? 1 : 0 }}
                      style={{ originX: 0 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

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

          {currentStep === "pick-product" && (
            <motion.div
              key="pick-product"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <ProductPickerStep
                onSelect={handleProductSelected}
                onBack={
                  initialStep === "create-org"
                    ? () => {
                        setDirection(-1)
                        setCurrentStep("create-org")
                      }
                    : undefined
                }
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}

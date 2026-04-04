"use client"

import { cn } from "@/lib/utils"
import Link from "next/link"
import { useState } from "react"
import { authClient } from "@/lib/auth/auth-client"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/auth/reset-password",
    })

    console.log("Forgot password response:", { error })

    setIsLoading(false)

    if (error) {
      setError(error.message || "Failed to send reset email")
      return
    }

    setEmailSent(true)
  }

  if (emailSent) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
          <p className="text-sm text-muted-foreground mt-2">
            We&apos;ve sent a password reset link to <strong>{email}</strong>
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-6">
            Click the link in your email to reset your password.
          </p>
          <Link
            href="/auth/login"
            className="text-sm text-primary hover:underline underline-offset-4"
          >
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          {error && (
            <Field>
              <p className="text-sm text-destructive text-center">{error}</p>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="email" className="sr-only">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-primary"
            />
          </Field>
          <Field className="pt-2">
            <Button type="submit" disabled={isLoading} className="w-full h-11">
              {isLoading ? "Sending..." : "Send reset link"}
            </Button>
          </Field>
          <div className="text-center mt-4 text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link
              href="/auth/login"
              className="text-primary hover:underline"
            >
              Sign in
            </Link>
          </div>
        </FieldGroup>
      </form>
    </div>
  )
}


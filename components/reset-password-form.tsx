"use client"

import { cn } from "@/lib/utils"
import Link from "next/link"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { authClient } from "@/lib/auth/auth-client"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function ResetPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long")
      return
    }

    if (!token) {
      setError("Invalid reset link. Please request a new one.")
      return
    }

    setIsLoading(true)

    const { error } = await authClient.resetPassword({
      newPassword: password,
      token,
    })

    setIsLoading(false)

    if (error) {
      setError(error.message || "Failed to reset password")
      return
    }

    setSuccess(true)
  }

  if (success) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Password reset successful</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Your password has been updated successfully.
          </p>
        </div>
        <Button asChild className="w-full h-11">
          <Link href="/auth/login">Sign in with new password</Link>
        </Button>
      </div>
    )
  }

  if (!token) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Invalid reset link</h1>
          <p className="text-sm text-muted-foreground mt-2">
            This password reset link is invalid or has expired.
          </p>
        </div>
        <Button asChild className="w-full h-11">
          <Link href="/auth/forgot-password">Request a new link</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Enter your new password below
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
            <FieldLabel htmlFor="password" className="sr-only">New Password</FieldLabel>
            <Input
              id="password"
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11 bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-primary"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="confirm-password" className="sr-only">
              Confirm New Password
            </FieldLabel>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="h-11 bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-primary"
            />
            <p className="text-[0.8rem] text-muted-foreground mt-2">
              Must be at least 8 characters long.
            </p>
          </Field>
          <Field className="pt-2">
            <Button type="submit" disabled={isLoading} className="w-full h-11">
              {isLoading ? "Resetting..." : "Reset password"}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}


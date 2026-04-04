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

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

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

    setIsLoading(true)

    const { error } = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL: "/onboarding",
    })

    setIsLoading(false)

    if (error) {
      setError(error.message || "Failed to create account")
      return
    }

    setEmailSent(true)
  }

  if (emailSent) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Check your email</CardTitle>
            <CardDescription>
              We&apos;ve sent a verification link to <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-sm text-muted-foreground">
              Click the link in your email to verify your account and get started.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Enter your details below to create your account
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
            <FieldLabel htmlFor="name" className="sr-only">Full Name</FieldLabel>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-11 bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-primary"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="email" className="sr-only">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-primary"
            />
          </Field>
          <Field className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="password" className="sr-only">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-primary"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password" className="sr-only">Confirm Password</FieldLabel>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-11 bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-primary"
              />
            </Field>
          </Field>
          <Field>
            <p className="text-[0.8rem] text-muted-foreground">
              Must be at least 8 characters long.
            </p>
          </Field>
          <Field className="pt-2">
            <Button type="submit" disabled={isLoading} className="w-full h-11">
              {isLoading ? "Creating Account..." : "Create Account"}
            </Button>
          </Field>
          <div className="text-center mt-4 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </FieldGroup>
      </form>
      <div className="mt-8 text-center text-xs text-muted-foreground">
        By clicking continue, you agree to our <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>{" "}
        and <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>.
      </div>
    </div>
  )
}

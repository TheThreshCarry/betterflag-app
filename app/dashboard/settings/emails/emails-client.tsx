"use client"

import { useState } from "react"
import {
  Mail,
  Save,
  Loader2,
  Send,
  Bell,
  FileText,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function EmailsClient() {
  // Sender configuration
  const [fromName, setFromName] = useState("")
  const [fromEmail, setFromEmail] = useState("")
  const [replyTo, setReplyTo] = useState("")
  const [savingSender, setSavingSender] = useState(false)

  // Notification toggles
  const [notifications, setNotifications] = useState({
    changelogPublished: true,
    newSubscriber: true,
    flagToggled: false,
    weeklyDigest: true,
    teamInviteAccepted: true,
    usageLimitWarning: true,
  })

  const handleSaveSender = async () => {
    setSavingSender(true)
    // Placeholder: backend not connected yet
    await new Promise((r) => setTimeout(r, 500))
    setSavingSender(false)
    toast.info("Email configuration will be available soon", {
      description:
        "Connect an email provider to start sending transactional emails.",
    })
  }

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }))
    toast.info("Notification preferences will be available soon")
  }

  return (
    <div className="space-y-12">
      {/* Sender Configuration */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Sender Configuration</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure how outgoing emails appear to recipients
            </p>
          </div>
          <Badge variant="secondary" className="font-normal">Coming Soon</Badge>
        </div>
        <div className="space-y-6 max-w-2xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="from-name">From Name</Label>
              <Input
                id="from-name"
                placeholder="ShipOS"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The sender name shown in email clients
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="from-email">From Email</Label>
              <Input
                id="from-email"
                type="email"
                placeholder="noreply@yourapp.com"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Must be a verified email address on your domain
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="reply-to">Reply-To Address</Label>
            <Input
              id="reply-to"
              type="email"
              placeholder="support@yourapp.com"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Where replies to your emails will be directed
            </p>
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button onClick={handleSaveSender} disabled={savingSender}>
              {savingSender ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Configuration
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Email Templates */}
      <div className="space-y-6 pt-6 border-t">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Email Templates</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Customize the templates used for transactional emails
            </p>
          </div>
          <Badge variant="secondary" className="font-normal">Coming Soon</Badge>
        </div>
        <div>
          <div className="space-y-3 max-w-3xl">
            {[
              {
                name: "Changelog Notification",
                description:
                  "Sent to subscribers when a new changelog is published",
                icon: Mail,
              },
              {
                name: "Welcome Email",
                description: "Sent to new subscribers when they sign up",
                icon: Mail,
              },
              {
                name: "Team Invitation",
                description: "Sent when someone is invited to your organization",
                icon: Mail,
              },
              {
                name: "Weekly Digest",
                description:
                  "Weekly summary of product updates sent to subscribers",
                icon: Mail,
              },
            ].map((template) => (
              <div
                key={template.name}
                className="flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                    <template.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{template.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {template.description}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" disabled>
                  Customize
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="space-y-6 pt-6 border-t">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Notification Preferences</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose which events trigger email notifications
            </p>
          </div>
        </div>
        <div>
          <div className="space-y-4 max-w-2xl">
            {(
              [
                {
                  key: "changelogPublished" as const,
                  label: "Changelog Published",
                  description:
                    "Get notified when a new changelog entry is published",
                },
                {
                  key: "newSubscriber" as const,
                  label: "New Subscriber",
                  description:
                    "Get notified when someone subscribes to your changelog",
                },
                {
                  key: "flagToggled" as const,
                  label: "Feature Flag Toggled",
                  description:
                    "Get notified when a feature flag is enabled or disabled",
                },
                {
                  key: "weeklyDigest" as const,
                  label: "Weekly Digest",
                  description:
                    "Receive a weekly summary of activity in your organization",
                },
                {
                  key: "teamInviteAccepted" as const,
                  label: "Team Invite Accepted",
                  description:
                    "Get notified when someone accepts a team invitation",
                },
                {
                  key: "usageLimitWarning" as const,
                  label: "Usage Limit Warning",
                  description:
                    "Get notified when approaching plan usage limits",
                },
              ] as const
            ).map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <Label>{item.label}</Label>
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                <Switch
                  checked={notifications[item.key]}
                  onCheckedChange={() => toggleNotification(item.key)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

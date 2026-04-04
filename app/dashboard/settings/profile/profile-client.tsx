"use client"

import { useState } from "react"
import {
  User,
  Save,
  Loader2,
  CheckCircle2,
  Mail,
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ProfilePictureUpload } from "@/components/profile-picture-upload"
import { authClient } from "@/lib/auth/auth-client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileUser {
  name: string
  email: string
  image: string | null
  emailVerified: boolean
  username: string | null
}

interface ProfileClientProps {
  user: ProfileUser
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ProfileClient({ user }: ProfileClientProps) {
  const router = useRouter()
  const [name, setName] = useState(user.name)
  const [username, setUsername] = useState(user.username ?? "")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }

    setSaving(true)
    try {
      await authClient.updateUser({
        name: name.trim(),
        username: username.trim() || undefined,
      })
      toast.success("Profile updated")
      router.refresh()
    } catch {
      toast.error("Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  const hasChanges =
    name !== user.name || username !== (user.username ?? "")

  return (
    <div className="space-y-12">
      {/* Profile Picture */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Profile Picture</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload a profile picture to personalize your account
            </p>
          </div>
        </div>
        <div className="flex py-2">
          <ProfilePictureUpload
            currentImage={user.image}
            userName={user.name}
          />
        </div>
      </div>

      {/* Personal Information */}
      <div className="space-y-6 pt-6 border-t">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Personal Information</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Update your name, username, and view account details
            </p>
          </div>
        </div>
        <div className="space-y-6 max-w-2xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="profile-name">Full Name</Label>
              <Input
                id="profile-name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-username">Username</Label>
              <Input
                id="profile-username"
                placeholder="johndoe"
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_-]/g, "")
                  )
                }
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Email</Label>
            <div className="flex items-center gap-2">
              <Input value={user.email} disabled className="flex-1" />
              {user.emailVerified ? (
                <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400 font-normal">
                  <CheckCircle2 className="h-3 w-3" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="secondary" className="font-normal">Unverified</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Email address cannot be changed here
            </p>
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !hasChanges}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

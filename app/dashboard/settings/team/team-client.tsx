"use client"

import { useState } from "react"
import {
  Users,
  Plus,
  Loader2,
  Mail,
  Shield,
  Crown,
  UserMinus,
  Clock,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Separator } from "@/components/ui/separator"
import { authClient } from "@/lib/auth/auth-client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MemberRole = "owner" | "admin" | "member"

interface Member {
  id: string
  userId: string
  role: MemberRole
  createdAt: string
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
}

interface Invitation {
  id: string
  email: string
  role: MemberRole | null
  status: string
  expiresAt: string
  inviterId: string
}

interface TeamClientProps {
  organization: { id: string; name: string; slug: string } | null
  initialMembers: Member[]
  initialInvitations: Invitation[]
  currentUserId: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function getRoleBadge(role: string) {
  switch (role) {
    case "owner":
      return (
        <Badge variant="default" className="gap-1">
          <Crown className="h-3 w-3" />
          Owner
        </Badge>
      )
    case "admin":
      return (
        <Badge variant="secondary" className="gap-1">
          <Shield className="h-3 w-3" />
          Admin
        </Badge>
      )
    default:
      return <Badge variant="outline">Member</Badge>
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function TeamClient({
  organization,
  initialMembers,
  initialInvitations,
  currentUserId,
}: TeamClientProps) {
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [invitations, setInvitations] = useState<Invitation[]>(initialInvitations)

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<string>("member")
  const [inviting, setInviting] = useState(false)

  // Remove member dialog
  const [removeOpen, setRemoveOpen] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null)
  const [removing, setRemoving] = useState(false)

  // Role change loading
  const [roleLoading, setRoleLoading] = useState<string | null>(null)

  // DashboardLayout guarantees an org is always present
  if (!organization) {
    return null
  }

  // ------ Handlers ------

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Email is required")
      return
    }

    setInviting(true)
    try {
      await authClient.organization.inviteMember({
        organizationId: organization.id,
        email: inviteEmail.trim(),
        role: inviteRole as "member" | "admin",
      })
      toast.success(`Invitation sent to ${inviteEmail}`)
      setInvitations([
        ...invitations,
        {
          id: crypto.randomUUID(),
          email: inviteEmail.trim(),
          role: inviteRole as MemberRole,
          status: "pending",
          expiresAt: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
          inviterId: currentUserId,
        },
      ])
      setInviteEmail("")
      setInviteRole("member")
      setInviteOpen(false)
      router.refresh()
    } catch {
      toast.error("Failed to send invitation")
    } finally {
      setInviting(false)
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await authClient.organization.cancelInvitation({
        invitationId,
      })
      setInvitations(invitations.filter((i) => i.id !== invitationId))
      toast.success("Invitation cancelled")
    } catch {
      toast.error("Failed to cancel invitation")
    }
  }

  const handleRoleChange = async (memberId: string, newRole: MemberRole) => {
    setRoleLoading(memberId)
    try {
      await authClient.organization.updateMemberRole({
        organizationId: organization.id,
        memberId,
        role: newRole as "member" | "admin",
      })
      setMembers(
        members.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      )
      toast.success("Member role updated")
    } catch {
      toast.error("Failed to update role")
    } finally {
      setRoleLoading(null)
    }
  }

  const handleRemoveMember = async () => {
    if (!memberToRemove) return

    setRemoving(true)
    try {
      await authClient.organization.removeMember({
        organizationId: organization.id,
        memberIdOrEmail: memberToRemove.userId,
      })
      setMembers(members.filter((m) => m.id !== memberToRemove.id))
      setRemoveOpen(false)
      setMemberToRemove(null)
      toast.success("Member removed from organization")
      router.refresh()
    } catch {
      toast.error("Failed to remove member")
    } finally {
      setRemoving(false)
    }
  }

  const currentMember = members.find((m) => m.userId === currentUserId)
  const isOwnerOrAdmin =
    currentMember?.role === "owner" || currentMember?.role === "admin"

  return (
    <div className="space-y-12">
      {/* Members */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Team Members</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage who has access to {organization.name}
            </p>
          </div>
          {isOwnerOrAdmin && (
            <Button onClick={() => setInviteOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          )}
        </div>
        <div>
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No members</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                Invite team members to collaborate on your projects.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  {isOwnerOrAdmin && (
                    <TableHead className="text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id} className="hover:bg-muted/50 group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={member.user.image ?? undefined}
                            alt={member.user.name}
                          />
                          <AvatarFallback className="text-xs">
                            {getInitials(member.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.user.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {member.user.email}
                          </p>
                        </div>
                        {member.userId === currentUserId && (
                          <Badge variant="outline" className="text-xs font-normal">
                            You
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isOwnerOrAdmin &&
                      member.role !== "owner" &&
                      member.userId !== currentUserId ? (
                        <Select
                          value={member.role}
                          onValueChange={(value) =>
                            handleRoleChange(member.id, value as MemberRole)
                          }
                          disabled={roleLoading === member.id}
                        >
                          <SelectTrigger className="w-[130px] h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        getRoleBadge(member.role)
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(member.createdAt)}
                    </TableCell>
                    {isOwnerOrAdmin && (
                      <TableCell className="text-right">
                        {member.role !== "owner" &&
                          member.userId !== currentUserId && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                setMemberToRemove(member)
                                setRemoveOpen(true)
                              }}
                            >
                              <UserMinus className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="space-y-6 pt-6 border-t">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Pending Invitations</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Invitations that haven&apos;t been accepted yet
              </p>
            </div>
          </div>
          <div>
            <div className="space-y-3 max-w-3xl">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{invitation.email}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <Clock className="h-3 w-3" />
                        <span>
                          Expires {formatDate(invitation.expiresAt)}
                        </span>
                        {invitation.role && (
                          <>
                            <span>·</span>
                            <span className="capitalize">
                              {invitation.role}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-normal text-xs">Pending</Badge>
                    {isOwnerOrAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          handleCancelInvitation(invitation.id)
                        }
                      >
                        <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join {organization.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">
                    <div className="flex flex-col">
                      <span>Member</span>
                      <span className="text-xs text-muted-foreground">
                        Can view and manage resources
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex flex-col">
                      <span>Admin</span>
                      <span className="text-xs text-muted-foreground">
                        Full access including settings
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation */}
      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <strong>{memberToRemove?.user.name}</strong> from{" "}
              {organization.name}? They will lose access to all organization
              resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Member"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

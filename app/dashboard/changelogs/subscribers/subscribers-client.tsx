"use client"

import { useState } from "react"
import { Plus, Trash2, Users, Mail } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

import type { ChangelogSubscription, Customer } from "@/lib/db/schema"
import {
  addSubscriber,
  unsubscribe,
} from "@/lib/actions/changelog-subscriptions"

type SubscriberWithCustomer = ChangelogSubscription & {
  customer: Customer | undefined | null
}

interface SubscribersClientProps {
  initialSubscribers: SubscriberWithCustomer[]
}

export function SubscribersClient({
  initialSubscribers,
}: SubscribersClientProps) {
  const [subscribers, setSubscribers] =
    useState<SubscriberWithCustomer[]>(initialSubscribers)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isRemoveOpen, setIsRemoveOpen] = useState(false)
  const [selectedSubscriber, setSelectedSubscriber] =
    useState<SubscriberWithCustomer | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [formData, setFormData] = useState({
    email: "",
    name: "",
  })

  const resetForm = () => {
    setFormData({ email: "", name: "" })
  }

  const handleAdd = async () => {
    if (!formData.email.trim()) {
      toast.error("Email is required")
      return
    }

    setIsLoading(true)
    try {
      const { customer, subscription } = await addSubscriber(formData)
      setSubscribers([
        {
          ...subscription,
          customer,
        },
        ...subscribers,
      ])
      setIsAddOpen(false)
      resetForm()
      toast.success("Subscriber added")
    } catch {
      toast.error("Failed to add subscriber")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemove = async () => {
    if (!selectedSubscriber) return

    setIsLoading(true)
    try {
      await unsubscribe(selectedSubscriber.id)
      setSubscribers(
        subscribers.filter((s) => s.id !== selectedSubscriber.id)
      )
      setIsRemoveOpen(false)
      setSelectedSubscriber(null)
      toast.success("Subscriber removed")
    } catch {
      toast.error("Failed to remove subscriber")
    } finally {
      setIsLoading(false)
    }
  }

  const openRemoveDialog = (subscriber: SubscriberWithCustomer) => {
    setSelectedSubscriber(subscriber)
    setIsRemoveOpen(true)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Subscribers</CardTitle>
                <CardDescription>
                  Manage users subscribed to your changelog updates
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={() => {
                resetForm()
                setIsAddOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Subscriber
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {subscribers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">
                No subscribers yet
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add subscribers to notify them about new releases
              </p>
              <Button
                className="mt-4"
                onClick={() => {
                  resetForm()
                  setIsAddOpen(true)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Subscriber
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Subscribed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscribers.map((subscriber) => (
                  <TableRow key={subscriber.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{subscriber.customer?.email || "--"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {subscriber.customer?.name || (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(subscriber.subscribedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">Active</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openRemoveDialog(subscriber)}
                        title="Unsubscribe"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Subscriber Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Subscriber</DialogTitle>
            <DialogDescription>
              Add a new subscriber to receive changelog updates
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={isLoading}>
              {isLoading ? "Adding..." : "Add Subscriber"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Subscriber Dialog */}
      <AlertDialog open={isRemoveOpen} onOpenChange={setIsRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsubscribe</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unsubscribe{" "}
              {selectedSubscriber?.customer?.email || "this user"}? They will no
              longer receive changelog updates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? "Removing..." : "Unsubscribe"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

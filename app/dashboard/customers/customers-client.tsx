"use client"

import { useState } from "react"
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Mail,
  Eye,
  X,
  User,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
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
import { Separator } from "@/components/ui/separator"

import type { Customer } from "@/lib/db/schema"
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/lib/actions/customers"

interface CustomersClientProps {
  initialCustomers: Customer[]
}

export function CustomersClient({ initialCustomers }: CustomersClientProps) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  )
  const [isLoading, setIsLoading] = useState(false)

  const [formData, setFormData] = useState({
    email: "",
    name: "",
    externalId: "",
  })

  const resetForm = () => {
    setFormData({ email: "", name: "", externalId: "" })
  }

  const handleCreate = async () => {
    if (!formData.email.trim() && !formData.name.trim()) {
      toast.error("At least an email or name is required")
      return
    }

    setIsLoading(true)
    try {
      const newCustomer = await createCustomer({
        email: formData.email || null,
        name: formData.name || null,
        externalId: formData.externalId || null,
      })
      setCustomers([newCustomer, ...customers])
      setIsCreateOpen(false)
      resetForm()
      toast.success("Customer created successfully")
    } catch {
      toast.error("Failed to create customer")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = async () => {
    if (!selectedCustomer) return

    if (!formData.email.trim() && !formData.name.trim()) {
      toast.error("At least an email or name is required")
      return
    }

    setIsLoading(true)
    try {
      const updatedCustomer = await updateCustomer(selectedCustomer.id, {
        email: formData.email || null,
        name: formData.name || null,
        externalId: formData.externalId || null,
      })
      setCustomers(
        customers.map((c) =>
          c.id === selectedCustomer.id ? updatedCustomer : c
        )
      )
      setIsEditOpen(false)
      setSelectedCustomer(null)
      resetForm()
      toast.success("Customer updated successfully")
    } catch {
      toast.error("Failed to update customer")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedCustomer) return

    setIsLoading(true)
    try {
      await deleteCustomer(selectedCustomer.id)
      setCustomers(customers.filter((c) => c.id !== selectedCustomer.id))
      setIsDeleteOpen(false)
      setSelectedCustomer(null)
      toast.success("Customer deleted successfully")
    } catch {
      toast.error("Failed to delete customer")
    } finally {
      setIsLoading(false)
    }
  }

  const openViewDialog = (customer: Customer) => {
    setSelectedCustomer(customer)
    setIsViewOpen(true)
  }

  const openEditDialog = (customer: Customer) => {
    setSelectedCustomer(customer)
    setFormData({
      email: customer.email || "",
      name: customer.name || "",
      externalId: customer.externalId || "",
    })
    setIsEditOpen(true)
  }

  const openDeleteDialog = (customer: Customer) => {
    setSelectedCustomer(customer)
    setIsDeleteOpen(true)
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
                <CardTitle>Customers</CardTitle>
                <CardDescription>
                  Manage your customers and their information
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={() => {
                resetForm()
                setIsCreateOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No customers yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first customer to get started
              </p>
              <Button
                className="mt-4"
                onClick={() => {
                  resetForm()
                  setIsCreateOpen(true)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>External ID</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="font-medium">
                          {customer.name || (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {customer.email || (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.externalId ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {customer.externalId}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(customer.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openViewDialog(customer)}
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(customer)}
                          title="Edit customer"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(customer)}
                          title="Delete customer"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Customer Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
            <DialogDescription>
              View detailed information about this customer
            </DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-lg">
                    {selectedCustomer.name || "Unnamed Customer"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedCustomer.email || "No email"}
                  </p>
                </div>
              </div>
              <Separator />
              <div className="grid gap-3">
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    ID
                  </span>
                  <span className="col-span-2 text-sm font-mono">
                    {selectedCustomer.id}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Name
                  </span>
                  <span className="col-span-2 text-sm">
                    {selectedCustomer.name || "--"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Email
                  </span>
                  <span className="col-span-2 text-sm">
                    {selectedCustomer.email || "--"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    External ID
                  </span>
                  <span className="col-span-2 text-sm font-mono">
                    {selectedCustomer.externalId || "--"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Metadata
                  </span>
                  <span className="col-span-2 text-sm font-mono">
                    {selectedCustomer.metadata &&
                    Object.keys(
                      selectedCustomer.metadata as Record<string, unknown>
                    ).length > 0
                      ? JSON.stringify(selectedCustomer.metadata, null, 2)
                      : "--"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Created
                  </span>
                  <span className="col-span-2 text-sm">
                    {new Date(selectedCustomer.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Updated
                  </span>
                  <span className="col-span-2 text-sm">
                    {new Date(selectedCustomer.updatedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setIsViewOpen(false)
                if (selectedCustomer) openEditDialog(selectedCustomer)
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Customer Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
            <DialogDescription>
              Add a new customer to your workspace
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="externalId">External ID (optional)</Label>
              <Input
                id="externalId"
                placeholder="e.g., stripe_cus_123"
                value={formData.externalId}
                onChange={(e) =>
                  setFormData({ ...formData, externalId: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                An optional identifier from an external system
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isLoading}>
              {isLoading ? "Creating..." : "Add Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>
              Update customer information
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-externalId">External ID (optional)</Label>
              <Input
                id="edit-externalId"
                placeholder="e.g., stripe_cus_123"
                value={formData.externalId}
                onChange={(e) =>
                  setFormData({ ...formData, externalId: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Customer Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              {selectedCustomer?.name || selectedCustomer?.email || "this customer"}?
              This action cannot be undone and will also remove any associated
              subscriptions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

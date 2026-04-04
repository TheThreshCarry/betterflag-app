"use client"

import { useState } from "react"
import {
  Globe,
  Plus,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Domain {
  id: string
  domain: string
  status: "pending" | "verified" | "failed"
  addedAt: string
  verifiedAt: string | null
  dnsRecords: DnsRecord[]
}

interface DnsRecord {
  type: string
  name: string
  value: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusBadge(status: Domain["status"]) {
  switch (status) {
    case "verified":
      return (
        <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          Verified
        </Badge>
      )
    case "failed":
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Failed
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      )
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function generateDnsRecords(domain: string): DnsRecord[] {
  return [
    {
      type: "CNAME",
      name: domain,
      value: "cname.shipos.app",
    },
    {
      type: "TXT",
      name: `_verification.${domain}`,
      value: `shipos-verify=${btoa(domain).slice(0, 20)}`,
    },
  ]
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function DomainsClient() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [newDomain, setNewDomain] = useState("")
  const [adding, setAdding] = useState(false)
  const [domainToDelete, setDomainToDelete] = useState<Domain | null>(null)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null)
  const [copiedValue, setCopiedValue] = useState<string | null>(null)

  const handleAddDomain = async () => {
    const domainValue = newDomain.trim().toLowerCase()

    if (!domainValue) {
      toast.error("Domain name is required")
      return
    }

    // Basic domain validation
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domainValue)) {
      toast.error("Please enter a valid domain name")
      return
    }

    if (domains.some((d) => d.domain === domainValue)) {
      toast.error("This domain has already been added")
      return
    }

    setAdding(true)
    // Placeholder: backend not connected yet
    await new Promise((r) => setTimeout(r, 600))

    const newDomainEntry: Domain = {
      id: crypto.randomUUID(),
      domain: domainValue,
      status: "pending",
      addedAt: new Date().toISOString(),
      verifiedAt: null,
      dnsRecords: generateDnsRecords(domainValue),
    }

    setDomains([...domains, newDomainEntry])
    setNewDomain("")
    setAddOpen(false)
    setAdding(false)
    setExpandedDomain(newDomainEntry.id)
    toast.success("Domain added", {
      description: "Configure your DNS records to verify ownership.",
    })
  }

  const handleVerify = async (domainId: string) => {
    setVerifying(domainId)
    // Placeholder: backend not connected yet
    await new Promise((r) => setTimeout(r, 1500))
    setVerifying(null)
    toast.info("Domain verification will be available soon", {
      description: "Connect a backend to enable DNS verification checks.",
    })
  }

  const handleDelete = async () => {
    if (!domainToDelete) return
    // Placeholder: backend not connected yet
    setDomains(domains.filter((d) => d.id !== domainToDelete.id))
    setDeleteOpen(false)
    setDomainToDelete(null)
    toast.success("Domain removed")
  }

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedValue(value)
      toast.success("Copied to clipboard")
      setTimeout(() => setCopiedValue(null), 2000)
    } catch {
      toast.error("Failed to copy")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Custom Domains</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add custom domains for your changelog, docs, and public pages
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Domain
        </Button>
      </div>

      <div>
        {domains.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Globe className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No custom domains</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground mx-auto">
              Add a custom domain to serve your changelog, documentation, and
              public pages on your own domain.
            </p>
            <Button
              className="mt-6"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Domain
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {domains.map((domain) => (
              <div key={domain.id} className="rounded-lg border bg-card">
                <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{domain.domain}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Added {formatDate(domain.addedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(domain.status)}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-2"
                      onClick={() => handleVerify(domain.id)}
                      disabled={
                        verifying === domain.id ||
                        domain.status === "verified"
                      }
                    >
                      {verifying === domain.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setExpandedDomain(
                          expandedDomain === domain.id
                            ? null
                            : domain.id
                        )
                      }}
                    >
                      <svg
                        className={`h-4 w-4 transition-transform ${
                          expandedDomain === domain.id ? "rotate-180" : ""
                        }`}
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setDomainToDelete(domain)
                        setDeleteOpen(true)
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* DNS Records (expandable) */}
                {expandedDomain === domain.id && (
                  <div className="border-t bg-muted/20 p-5">
                    <p className="text-sm font-medium">
                      DNS Configuration
                    </p>
                    <p className="mb-4 text-sm text-muted-foreground mt-1">
                      Add the following DNS records to your domain provider to
                      verify ownership and enable routing.
                    </p>
                    <div className="space-y-3">
                      {domain.dnsRecords.map((record, idx) => (
                        <div
                          key={idx}
                          className="overflow-hidden rounded-md border bg-background"
                        >
                          <div className="grid grid-cols-[80px_1fr_1fr_40px] items-center gap-2 p-3 text-sm">
                            <div>
                              <Badge variant="outline" className="font-normal text-xs bg-muted/50">
                                {record.type}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                Name
                              </p>
                              <code className="text-sm font-mono">{record.name}</code>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                Value
                              </p>
                              <code className="text-sm font-mono break-all">
                                {record.value}
                              </code>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => copyToClipboard(record.value)}
                            >
                              {copiedValue === record.value ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Domain Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Domain</DialogTitle>
            <DialogDescription>
              Enter the domain you want to use for your public-facing pages.
              You&apos;ll need to configure DNS records after adding it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="domain-name">Domain Name</Label>
              <Input
                id="domain-name"
                placeholder="changelog.yourapp.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter a full domain or subdomain (e.g., docs.example.com)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddDomain} disabled={adding}>
              {adding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Domain
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Domain</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <strong>{domainToDelete?.domain}</strong>? Any pages using this
              domain will no longer be accessible through it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Domain
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

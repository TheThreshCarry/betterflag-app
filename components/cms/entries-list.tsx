"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  FileText,
  Trash2,
  Pencil,
  Send,
  ArchiveRestore,
  ExternalLink,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import type { ContentType, Entry } from "@/lib/db/schema";
import { getStatusBadgeVariant } from "@/lib/cms/schema-utils";
import {
  bulkDeleteEntries,
  bulkPublishEntries,
  bulkUnpublishEntries,
  deleteEntry,
  publishEntry,
  unpublishEntry,
} from "@/lib/actions/entries";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface EntriesListProps {
  contentType: ContentType;
  entries: Entry[];
}

type StatusFilter = "all" | "draft" | "published" | "archived";

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function EntriesList({ contentType, entries }: EntriesListProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filteredEntries =
    statusFilter === "all"
      ? entries
      : entries.filter((e) => e.status === statusFilter);

  const counts = {
    all: entries.length,
    draft: entries.filter((e) => e.status === "draft").length,
    published: entries.filter((e) => e.status === "published").length,
    archived: entries.filter((e) => e.status === "archived").length,
  };

  useEffect(() => {
    setSelected(new Set());
  }, [statusFilter]);

  async function handleDelete(id: string) {
    try {
      await deleteEntry(id);
      toast.success("Entry deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete entry");
    }
  }

  async function handlePublish(id: string) {
    try {
      await publishEntry(id);
      toast.success("Entry published");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to publish entry";
      toast.error(message);
    }
  }

  async function handleUnpublish(id: string) {
    try {
      await unpublishEntry(id);
      toast.success("Entry unpublished");
      router.refresh();
    } catch {
      toast.error("Failed to unpublish entry");
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected(new Set(filteredEntries.map((e) => e.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  const allFilteredSelected =
    filteredEntries.length > 0 &&
    filteredEntries.every((e) => selected.has(e.id));

  async function handleBulkPublish() {
    const ids = Array.from(selected);
    try {
      await bulkPublishEntries(ids);
      toast.success(`Published ${ids.length} entries`);
      clearSelection();
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to publish entries";
      toast.error(message);
    }
  }

  async function handleBulkUnpublish() {
    const ids = Array.from(selected);
    try {
      await bulkUnpublishEntries(ids);
      toast.success(`Unpublished ${ids.length} entries`);
      clearSelection();
      router.refresh();
    } catch {
      toast.error("Failed to unpublish entries");
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selected);
    if (!confirm(`Delete ${ids.length} entries? This cannot be undone.`)) return;
    try {
      await bulkDeleteEntries(ids);
      toast.success(`Deleted ${ids.length} entries`);
      clearSelection();
      router.refresh();
    } catch {
      toast.error("Failed to delete entries");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">
          Entries
        </h2>
        <Button asChild>
          <Link
            href={`/dashboard/cms/content-types/${contentType.id}/entries/new`}
          >
            <Plus className="mr-2 size-4" />
            New Entry
          </Link>
        </Button>
      </div>

      {/* Status Filter Tabs */}
      <Tabs
        value={statusFilter}
        onValueChange={(v) => setStatusFilter(v as StatusFilter)}
      >
        <TabsList>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="draft">Draft ({counts.draft})</TabsTrigger>
          <TabsTrigger value="published">
            Published ({counts.published})
          </TabsTrigger>
          <TabsTrigger value="archived">
            Archived ({counts.archived})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {selected.size > 0 && (
        <div className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <span className="text-muted-foreground font-medium">
            {selected.size} selected
          </span>
          <Button size="sm" variant="outline" onClick={handleBulkPublish}>
            <Send className="mr-1 size-3" />
            Publish
          </Button>
          <Button size="sm" variant="outline" onClick={handleBulkUnpublish}>
            <ArchiveRestore className="mr-1 size-3" />
            Unpublish
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleBulkDelete}
          >
            <Trash2 className="mr-1 size-3" />
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      )}

      {/* Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {filteredEntries.length}{" "}
            {filteredEntries.length === 1 ? "entry" : "entries"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="text-muted-foreground mb-4 size-10" />
              <p className="text-muted-foreground text-sm">
                {statusFilter === "all"
                  ? "No entries yet. Create your first entry to get started."
                  : `No ${statusFilter} entries found.`}
              </p>
              {statusFilter === "all" && (
                <Button className="mt-4" size="sm" asChild>
                  <Link
                    href={`/dashboard/cms/content-types/${contentType.id}/entries/new`}
                  >
                    <Plus className="mr-2 size-4" />
                    New Entry
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={(v) => {
                        if (v === true) selectAllFiltered();
                        else clearSelection();
                      }}
                      aria-label="Select all visible entries"
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => {
                  const data = entry.data as Record<string, unknown>;
                  const title = (data?.title as string) || entry.slug;
                  const entryUrl = `/dashboard/cms/content-types/${contentType.id}/entries/${entry.id}`;

                  return (
                    <ContextMenu key={entry.id}>
                      <ContextMenuTrigger asChild>
                        <TableRow className="cursor-context-menu">
                          <TableCell
                            className="w-10"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={selected.has(entry.id)}
                              onCheckedChange={() => toggleSelected(entry.id)}
                              aria-label={`Select ${title}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{title}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {entry.slug}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(entry.status)}>
                              {entry.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(entry.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {entry.status === "draft" && (
                                <Button
                                  size="sm"
                                  onClick={() => handlePublish(entry.id)}
                                >
                                  Publish
                                </Button>
                              )}
                              {entry.status === "published" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUnpublish(entry.id)}
                                >
                                  Unpublish
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" asChild>
                                <Link href={entryUrl}>
                                  <Pencil className="size-4" />
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDelete(entry.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-48">
                        <ContextMenuItem
                          onClick={() => router.push(entryUrl)}
                        >
                          <Pencil className="mr-2 size-4" />
                          Edit
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => window.open(entryUrl, "_blank")}
                        >
                          <ExternalLink className="mr-2 size-4" />
                          Open in New Tab
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => {
                            navigator.clipboard.writeText(entry.slug);
                            toast.success("Slug copied to clipboard");
                          }}
                        >
                          <Copy className="mr-2 size-4" />
                          Copy Slug
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        {entry.status === "draft" && (
                          <ContextMenuItem
                            onClick={() => handlePublish(entry.id)}
                          >
                            <Send className="mr-2 size-4" />
                            Publish
                          </ContextMenuItem>
                        )}
                        {entry.status === "published" && (
                          <ContextMenuItem
                            onClick={() => handleUnpublish(entry.id)}
                          >
                            <ArchiveRestore className="mr-2 size-4" />
                            Unpublish
                          </ContextMenuItem>
                        )}
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(entry.id)}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Delete
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

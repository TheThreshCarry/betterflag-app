"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FileText, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { ContentType, Entry } from "@/lib/db/schema";
import {
  deleteEntry,
  publishEntry,
  unpublishEntry,
} from "@/lib/actions/entries";
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

interface EntriesListProps {
  contentType: ContentType;
  entries: Entry[];
}

type StatusFilter = "all" | "draft" | "published" | "archived";

function getStatusVariant(
  status: string | null
): "default" | "secondary" | "outline" {
  switch (status) {
    case "published":
      return "default";
    case "draft":
      return "secondary";
    case "archived":
      return "outline";
    default:
      return "secondary";
  }
}

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">
          Entries for {contentType.name}
        </h1>
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

      {/* Bulk actions placeholder */}
      {/* TODO: Implement bulk select & actions (publish, unpublish, delete) */}

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

                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{title}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {entry.slug}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(entry.status)}>
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
                              variant="ghost"
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
                            <Link
                              href={`/dashboard/cms/content-types/${contentType.id}/entries/${entry.id}`}
                            >
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

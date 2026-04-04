"use client";

import Link from "next/link";
import { Plus, FileText, ArrowRight } from "lucide-react";
import type { ContentType, Entry } from "@/lib/db/schema";
import { getStatusBadgeVariant } from "@/lib/cms/schema-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CmsOverviewProps {
  contentTypes: ContentType[];
  entries: (Entry & { contentType: ContentType })[];
}

export function CmsOverview({ contentTypes, entries }: CmsOverviewProps) {
  const entryCountByType = entries.reduce<Record<string, number>>(
    (acc, entry) => {
      acc[entry.contentTypeId] = (acc[entry.contentTypeId] || 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">CMS</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your content types and entries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/cms/content-types?new=true">
              <Plus className="mr-2 size-4" />
              New Content Type
            </Link>
          </Button>

          {contentTypes.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Plus className="mr-2 size-4" />
                  New Post
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {contentTypes.map((ct) => (
                  <DropdownMenuItem key={ct.id} asChild>
                    <Link
                      href={`/dashboard/cms/content-types/${ct.id}?new=true`}
                    >
                      <FileText className="mr-2 size-4" />
                      {ct.name}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {contentTypes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="text-muted-foreground mb-4 size-10" />
          <h2 className="text-lg font-semibold">No content types yet</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            Content types define the structure of your posts. Start with a
            template like Blog Post, or build your own from scratch.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Button asChild>
              <Link href="/dashboard/cms/content-types/new">
                <Plus className="mr-2 size-4" />
                Create from Template
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/cms/content-types/new?step=2">
                Start from Scratch
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contentTypes.map((ct) => (
            <Link
              key={ct.id}
              href={`/dashboard/cms/content-types/${ct.id}`}
              className="group flex flex-col rounded-lg border p-5 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-1">
                  <h3 className="font-medium flex items-center gap-2">
                    {ct.name}
                    <Badge variant={getStatusBadgeVariant(ct.status)} className="font-normal text-xs">
                      {ct.status}
                    </Badge>
                  </h3>
                  <p className="font-mono text-xs text-muted-foreground">
                    /{ct.slug}
                  </p>
                </div>
                <ArrowRight className="text-muted-foreground size-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              
              <div className="mt-auto pt-4 flex items-center justify-between text-sm text-muted-foreground border-t border-border/50">
                <span>
                  {entryCountByType[ct.id] || 0}{" "}
                  {(entryCountByType[ct.id] || 0) === 1
                    ? "entry"
                    : "entries"}
                </span>
                <span className="font-mono text-xs">v{ct.version}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

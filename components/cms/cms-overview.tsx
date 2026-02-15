"use client";

import Link from "next/link";
import { Plus, FileText, ArrowRight } from "lucide-react";
import type { ContentType, Entry } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

function getStatusVariant(
  status: ContentType["status"]
): "default" | "secondary" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "draft":
      return "secondary";
    case "deprecated":
      return "outline";
    default:
      return "secondary";
  }
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CMS</h1>
          <p className="text-muted-foreground mt-1">
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
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="text-muted-foreground mb-4 size-12" />
            <h2 className="text-xl font-semibold">No content types yet</h2>
            <p className="text-muted-foreground mt-2 max-w-md">
              Content types define the structure of your posts. Create your
              first content type to start publishing.
            </p>
            <Button className="mt-6" asChild>
              <Link href="/dashboard/cms/content-types?new=true">
                <Plus className="mr-2 size-4" />
                Create Content Type
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contentTypes.map((ct) => (
            <Link
              key={ct.id}
              href={`/dashboard/cms/content-types/${ct.id}`}
              className="group"
            >
              <Card className="transition-shadow group-hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        {ct.name}
                        <Badge variant={getStatusVariant(ct.status)}>
                          {ct.status}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="font-mono text-xs">
                        /{ct.slug}
                      </CardDescription>
                    </div>
                    <ArrowRight className="text-muted-foreground size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-muted-foreground flex items-center justify-between text-sm">
                    <span>
                      {entryCountByType[ct.id] || 0}{" "}
                      {(entryCountByType[ct.id] || 0) === 1
                        ? "entry"
                        : "entries"}
                    </span>
                    <span className="font-mono text-xs">v{ct.version}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

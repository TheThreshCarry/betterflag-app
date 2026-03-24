"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import type { ContentType, Entry } from "@/lib/db/schema";
import { setContentTypeStatus } from "@/lib/actions/content-types";
import { parseSchemaFields, getFieldLabel, getFieldSummary, getStatusBadgeVariant } from "@/lib/cms/schema-utils";
import { FieldTypeIcon } from "./field-type-icon";
import { EntriesList } from "./entries-list";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ContentTypeDetailProps {
  contentType: ContentType;
  entries: Entry[];
}

export function ContentTypeDetail({
  contentType,
  entries,
}: ContentTypeDetailProps) {
  const router = useRouter();

  const schemaFields = parseSchemaFields(contentType.schema);

  async function handleToggleStatus() {
    try {
      const newStatus = contentType.status === "active" ? "draft" : "active";
      await setContentTypeStatus(contentType.id, newStatus);
      toast.success(
        `Content type ${newStatus === "active" ? "activated" : "deactivated"}`
      );
      router.refresh();
    } catch {
      toast.error("Failed to update status");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            {contentType.name}
          </h1>
          <Badge variant={getStatusBadgeVariant(contentType.status)}>
            {contentType.status}
          </Badge>
          <Badge variant="outline" className="font-mono text-xs">
            v{contentType.version}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleToggleStatus}>
            {contentType.status === "active" ? (
              <>
                <ToggleRight className="mr-2 size-4" />
                Deactivate
              </>
            ) : (
              <>
                <ToggleLeft className="mr-2 size-4" />
                Activate
              </>
            )}
          </Button>

          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/dashboard/cms/content-types/${contentType.id}/schema`}
            >
              <Pencil className="mr-2 size-4" />
              Edit Schema
            </Link>
          </Button>

          <Button asChild>
            <Link
              href={`/dashboard/cms/content-types/${contentType.id}/entries/new`}
            >
              New Entry
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schema Fields</CardTitle>
          <CardDescription>
            {schemaFields.length}{" "}
            {schemaFields.length === 1 ? "field" : "fields"} defined in this
            content type.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {schemaFields.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No fields defined yet.{" "}
              <Link
                href={`/dashboard/cms/content-types/${contentType.id}/schema`}
                className="text-primary underline"
              >
                Edit the schema
              </Link>{" "}
              to add fields.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {schemaFields.map((field) => (
                <Badge
                  key={field.name}
                  variant="secondary"
                  className="flex items-center gap-1.5 px-2.5 py-1"
                >
                  <FieldTypeIcon type={field.type} className="size-3.5" />
                  <span>{getFieldLabel(field)}</span>
                  <span className="text-muted-foreground text-[10px]">
                    {getFieldSummary(field)}
                  </span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EntriesList contentType={contentType} entries={entries} />
    </div>
  );
}

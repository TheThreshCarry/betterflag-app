"use client";

import type { SchemaField } from "@/lib/cms/types";
import { getFieldLabel, getFieldSummary } from "@/lib/cms/schema-utils";
import { FieldTypeIcon } from "./field-type-icon";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Pencil, Trash2 } from "lucide-react";

interface SchemaFieldCardProps {
  field: SchemaField;
  index: number;
  total: number;
  onEdit: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function SchemaFieldCard({
  field,
  index,
  total,
  onEdit,
  onRemove,
  onMoveUp,
  onMoveDown,
}: SchemaFieldCardProps) {
  const label = getFieldLabel(field);
  const summary = getFieldSummary(field);

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-shadow hover:shadow-sm">
      {/* Left: icon + label / name */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <FieldTypeIcon
          type={field.type}
          className="size-5 shrink-0 text-muted-foreground"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate font-semibold text-sm leading-tight">
              {label}
            </span>
            <code className="truncate text-xs text-muted-foreground">
              {field.name}
            </code>
          </div>

          {summary && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {summary}
            </p>
          )}
        </div>
      </div>

      {/* Right: action buttons */}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={index === 0}
          onClick={onMoveUp}
          aria-label="Move field up"
        >
          <ChevronUp />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={index === total - 1}
          onClick={onMoveDown}
          aria-label="Move field down"
        >
          <ChevronDown />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onEdit}
          aria-label="Edit field"
        >
          <Pencil />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove field"
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

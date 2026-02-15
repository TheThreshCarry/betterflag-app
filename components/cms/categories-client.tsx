"use client";

import { Tags } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function CategoriesClient() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
        <p className="text-muted-foreground mt-1">
          Organize your entries with categories.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="size-5" />
            Categories
          </CardTitle>
          <CardDescription>
            Categories are managed through entry relations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Tags className="text-muted-foreground mb-4 size-10" />
            <h2 className="text-lg font-semibold">Coming soon</h2>
            <p className="text-muted-foreground mt-2 max-w-md text-sm">
              Categories are stored as entry relations with{" "}
              <code className="bg-muted rounded px-1 py-0.5 text-xs">
                type=&quot;category&quot;
              </code>
              . You can assign categories when editing an entry. A dedicated
              management interface for browsing and organizing categories is
              coming soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

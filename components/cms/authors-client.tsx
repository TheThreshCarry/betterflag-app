"use client";

import { Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AuthorsClient() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Authors</h1>
        <p className="text-muted-foreground mt-1">
          Manage authors for your content.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            Authors
          </CardTitle>
          <CardDescription>
            Authors are managed through entry relations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="text-muted-foreground mb-4 size-10" />
            <h2 className="text-lg font-semibold">Coming soon</h2>
            <p className="text-muted-foreground mt-2 max-w-md text-sm">
              Authors are stored as entry relations with{" "}
              <code className="bg-muted rounded px-1 py-0.5 text-xs">
                type=&quot;author&quot;
              </code>
              . You can assign authors when editing an entry. A dedicated
              management interface for browsing and managing authors is coming
              soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

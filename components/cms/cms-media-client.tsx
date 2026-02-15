"use client";

import { useRouter } from "next/navigation";
import { Image, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { CmsMedia } from "@/lib/db/schema";
import { deleteCmsMedia } from "@/lib/actions/cms-media";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CmsMediaClientProps {
  media: CmsMedia[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CmsMediaClient({ media }: CmsMediaClientProps) {
  const router = useRouter();

  async function handleDelete(id: string) {
    try {
      await deleteCmsMedia(id);
      toast.success("Media deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete media");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CMS Media</h1>
          <p className="text-muted-foreground mt-1">
            Browse and manage media files for your content.
          </p>
        </div>
        <Button disabled>
          <Upload className="mr-2 size-4" />
          Upload
        </Button>
      </div>

      {/* Media Grid */}
      {media.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Image className="text-muted-foreground mb-4 size-12" />
            <h2 className="text-xl font-semibold">No media yet</h2>
            <p className="text-muted-foreground mt-2 max-w-md text-sm">
              Upload media files to use them in your content entries.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {media.map((item) => (
            <Card key={item.id} className="group relative overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="truncate text-sm font-medium">
                  {item.slug}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {item.mimeType}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {formatBytes(item.size)}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {formatDate(item.createdAt)}
                </p>
                <div className="flex justify-end pt-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive size-8"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { Button } from "@/components/ui";
import { POSTMAN_IMPORT_URL } from "@/lib/postman";

export function AddToPostmanButton({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <Button
      variant="secondary"
      size={size}
      render={<a href={POSTMAN_IMPORT_URL} target="_blank" rel="noopener noreferrer" />}
    >
      Add to Postman
    </Button>
  );
}

"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function ManualAddSubmitButton(props: { mode?: "add" | "edit" }) {
  const { pending } = useFormStatus();
  const mode = props.mode ?? "add";

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {mode === "edit" ? "Updating…" : "Adding…"}
        </span>
      ) : mode === "edit" ? (
        "Update item"
      ) : (
        "Add item"
      )}
    </Button>
  );
}

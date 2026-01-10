import Link from "next/link";

import { PhotoAddClient } from "./photo-add-client";
import { AddItemBottomBar } from "@/components/layout/add-item-bottom-bar";
import { Button } from "@/components/ui/button";

export default function PhotoAddPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-32 pt-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Add by photo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Take a photo of what you have.
        </p>
      </div>

      <PhotoAddClient />

      <div className="mt-4">
        <Button asChild variant="ghost" className="w-full">
          <Link href="/inventory">Back to inventory</Link>
        </Button>
      </div>

      <AddItemBottomBar active="photo" />
    </div>
  );
}


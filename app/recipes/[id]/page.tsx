import Link from "next/link";

import { AddItemBottomBar } from "@/components/layout/add-item-bottom-bar";
import { Button } from "@/components/ui/button";
import { RecipeDetailClient } from "./recipe-detail-client";

export default async function RecipeDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-32 pt-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Recipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Step-by-step instructions.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/recipes">Back</Link>
        </Button>
      </div>

      <RecipeDetailClient id={id} />

      <AddItemBottomBar active="recipes" />
    </div>
  );
}


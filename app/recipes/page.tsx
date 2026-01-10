import { AddItemBottomBar } from "@/components/layout/add-item-bottom-bar";
import { RecipesClient } from "./recipes-client";

export default function RecipesPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-32 pt-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Recipes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose filters, then find the healthiest options.
        </p>
      </div>

      <RecipesClient />

      <AddItemBottomBar active="recipes" />
    </div>
  );
}


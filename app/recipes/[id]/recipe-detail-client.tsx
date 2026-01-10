"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";

import { Button } from "@/components/ui/button";

type Recipe = {
  id: string;
  title: string;
  description: string;
  servings: number;
  timeMinutes: number;
  pantryCoverage: number;
  missingIngredients: string[];
  ingredientsUsed: string[];
  steps: string[];
  imageUrl: string | null;
};

function readLastResults(): Recipe[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("recipes:lastResults");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as Recipe[];
  } catch {
    return [];
  }
}

export function RecipeDetailClient(props: { id: string }) {
  const recipe = useMemo(() => {
    const list = readLastResults();
    return (
      list.find((r) => r && typeof r.id === "string" && r.id === props.id) ??
      null
    );
  }, [props.id]);

  if (!recipe) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <div className="text-sm font-medium">Recipe not found</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Go back and generate recipes again.
        </div>
        <div className="mt-4">
          <Button asChild variant="secondary" className="w-full">
            <Link href="/recipes">Back to recipes</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="rounded-xl border bg-card p-4">
        {recipe.imageUrl ? (
          <div className="relative mb-4 aspect-[3/2] w-full overflow-hidden rounded-xl border bg-muted">
            <Image
              src={recipe.imageUrl}
              alt={recipe.title}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : null}
        <div className="text-lg font-semibold tracking-tight">
          {recipe.title}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {recipe.description}
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          {recipe.timeMinutes} min • Serves {recipe.servings} •{" "}
          {recipe.pantryCoverage}% pantry
        </div>
      </div>

      {recipe.missingIngredients.length ? (
        <div className="rounded-xl border bg-card p-4">
          <div className="text-sm font-medium">Missing (max 2)</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {recipe.missingIngredients.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-xl border bg-card p-4">
        <div className="text-sm font-medium">Ingredients you’ll use</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {recipe.ingredientsUsed.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="text-sm font-medium">Steps</div>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
          {recipe.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </div>

      <Button asChild variant="secondary" className="w-full">
        <Link href="/recipes">Back</Link>
      </Button>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import { consumeRecipeIngredientsAction } from "@/app/inventory/actions";
import { Button } from "@/components/ui/button";
import { MacroSummary } from "@/components/ui/macro-summary";

type Recipe = {
  id: string;
  title: string;
  description: string;
  servings: number;
  timeMinutes: number;
  pantryCoverage: number;
  missingIngredients: string[];
  ingredientsUsed: string[];
  ingredientsUsedDetailed?: Array<{
    name: string;
    imageUrl: string | null;
    amountG?: number | null;
    quantity?: number | null;
    quantityUnit?: "count" | "g" | "ml" | null;
  }>;
  steps: string[];
  imageUrl: string | null;
  macrosPerServing?: {
    caloriesKcal: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    sugarG: number | null;
  } | null;
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

function readConsumedRecipeFlag(recipeId: string) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(`recipes:consumed:${recipeId}`) === "1";
  } catch {
    return false;
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

  const [consumeStatus, setConsumeStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [consumeMessage, setConsumeMessage] = useState<string | null>(null);
  const [consumedOverride, setConsumedOverride] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [shoppingMessage, setShoppingMessage] = useState<string | null>(null);
  const [shoppingCopied, setShoppingCopied] = useState(false);

  const alreadyConsumed = useMemo(() => {
    if (consumedOverride) return true;
    if (!recipe?.id) return false;
    return readConsumedRecipeFlag(recipe.id);
  }, [consumedOverride, recipe]);

  const consumableIngredients = useMemo(() => {
    if (!recipe?.ingredientsUsedDetailed?.length) return [];
    return recipe.ingredientsUsedDetailed
      .map((i) => {
        const quantity = i.quantity;
        const quantityUnit = i.quantityUnit;
        if (
          typeof quantity !== "number" ||
          !Number.isFinite(quantity) ||
          quantity <= 0
        )
          return null;
        if (
          quantityUnit !== "count" &&
          quantityUnit !== "g" &&
          quantityUnit !== "ml"
        )
          return null;
        return {
          name: i.name,
          quantity,
          quantityUnit,
        };
      })
      .filter(
        (
          x,
        ): x is {
          name: string;
          quantity: number;
          quantityUnit: "count" | "g" | "ml";
        } => x !== null,
      );
  }, [recipe]);

  useEffect(() => {
    if (!confirmOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (consumeStatus === "loading") return;
      setConfirmOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmOpen, consumeStatus]);

  useEffect(() => {
    if (!shoppingCopied) return;
    const t = window.setTimeout(() => setShoppingCopied(false), 1200);
    return () => window.clearTimeout(t);
  }, [shoppingCopied]);

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
        {recipe.macrosPerServing ? (
          <div className="mt-2 text-xs text-muted-foreground">
            <MacroSummary macros={recipe.macrosPerServing} showSugar />
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-2">
          <Button
            type="button"
            className="w-full"
            disabled={consumeStatus === "loading" || alreadyConsumed}
            onClick={() => {
              if (!recipe) return;
              if (alreadyConsumed) return;

              if (consumableIngredients.length === 0) {
                setConsumeStatus("error");
                setConsumeMessage(
                  "This recipe is missing per-ingredient quantities, so pantry subtraction isn’t available.",
                );
                return;
              }

              setConfirmOpen(true);
            }}
          >
            {alreadyConsumed
              ? "Already Cooked"
              : consumeStatus === "loading"
                ? "Subtracting…"
                : "Cooked it"}
          </Button>

          {consumeMessage ? (
            <div
              className={
                consumeStatus === "error"
                  ? "text-sm text-red-600"
                  : "text-sm text-muted-foreground"
              }
            >
              {consumeMessage}
            </div>
          ) : null}

          {confirmOpen ? (
            <div className="fixed inset-0 z-50">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => {
                  if (consumeStatus === "loading") return;
                  setConfirmOpen(false);
                }}
              />
              <div className="absolute inset-x-0 bottom-0 p-4 sm:inset-0 sm:flex sm:items-center sm:justify-center">
                <div className="w-full max-w-md rounded-xl border bg-card p-4 shadow-lg">
                  <div className="text-base font-semibold tracking-tight">
                    Subtract from pantry?
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    This will subtract the ingredients used in this recipe from
                    your pantry. This can’t be undone.
                  </div>

                  <div className="mt-4 max-h-64 overflow-auto rounded-lg border bg-background">
                    <ul className="divide-y">
                      {consumableIngredients.map((i) => (
                        <li
                          key={`${i.name}|${i.quantity}|${i.quantityUnit}`}
                          className="flex items-center justify-between gap-3 px-3 py-2"
                        >
                          <div className="min-w-0 flex-1 text-sm">{i.name}</div>
                          <div className="shrink-0 text-xs text-muted-foreground">
                            {i.quantityUnit === "count"
                              ? `${Math.round(i.quantity)} ${i.name}`
                              : `${Math.round(i.quantity)} ${i.quantityUnit}`}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={consumeStatus === "loading"}
                      onClick={() => setConfirmOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={consumeStatus === "loading"}
                      onClick={async () => {
                        if (alreadyConsumed) return;

                        setConsumeStatus("loading");
                        setConsumeMessage(null);
                        try {
                          const res = await consumeRecipeIngredientsAction({
                            ingredients: consumableIngredients,
                          });
                          if (!res.ok) throw new Error("Pantry update failed.");
                          try {
                            window.localStorage.setItem(
                              `recipes:consumed:${recipe.id}`,
                              "1",
                            );
                          } catch {}
                          setConsumedOverride(true);
                          setConsumeStatus("success");
                          setConsumeMessage(
                            res.skipped > 0
                              ? "Pantry updated (some items couldn’t be matched)."
                              : "Pantry updated.",
                          );
                          setConfirmOpen(false);
                        } catch {
                          setConsumeStatus("error");
                          setConsumeMessage(
                            "Could not update pantry. Try again.",
                          );
                        }
                      }}
                    >
                      {consumeStatus === "loading" ? "Subtracting…" : "Confirm"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {recipe.missingIngredients.length ? (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Shopping list</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Missing ingredients for this recipe.
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={async () => {
                const text = recipe.missingIngredients.join("\n");
                try {
                  await navigator.clipboard.writeText(text);
                  setShoppingMessage(null);
                  setShoppingCopied(true);
                } catch {
                  setShoppingCopied(false);
                  setShoppingMessage(
                    "Could not copy. Select and copy manually.",
                  );
                }
              }}
            >
              {shoppingCopied ? (
                <span className="inline-flex items-center gap-2">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 animate-in zoom-in-50 fade-in duration-200"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <span className="animate-in fade-in duration-200">
                    Copied
                  </span>
                </span>
              ) : (
                "Copy"
              )}
            </Button>
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {recipe.missingIngredients.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          {shoppingMessage ? (
            <div className="mt-2 text-xs text-red-600">{shoppingMessage}</div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border bg-card p-4">
        <div className="text-sm font-medium">Ingredients you’ll use</div>
        {recipe.ingredientsUsedDetailed?.length ? (
          <ul className="mt-3 grid grid-cols-1 gap-2">
            {recipe.ingredientsUsedDetailed.map((i) => (
              <li key={i.name} className="flex items-center gap-3">
                {i.imageUrl ? (
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-muted">
                    <Image
                      src={i.imageUrl}
                      alt={i.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1 text-sm">{i.name}</div>
                {typeof i.quantity === "number" &&
                Number.isFinite(i.quantity) &&
                i.quantityUnit ? (
                  <div className="shrink-0 text-xs text-muted-foreground">
                    {i.quantityUnit === "count"
                      ? `${Math.round(i.quantity)} ${i.name}`
                      : `${Math.round(i.quantity)} ${i.quantityUnit}`}
                  </div>
                ) : typeof i.amountG === "number" &&
                  Number.isFinite(i.amountG) ? (
                  <div className="shrink-0 text-xs text-muted-foreground">
                    {Math.round(i.amountG)} g
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {recipe.ingredientsUsed.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        )}
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

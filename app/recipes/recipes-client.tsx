"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MacroSummary } from "@/components/ui/macro-summary";
import { Select } from "@/components/ui/select";

type MealType = "breakfast" | "lunch" | "dinner";
type Who = "adults" | "kids";
type Servings = 1 | 2 | 3 | 4;
type Diet =
  | "none"
  | "vegetarian"
  | "vegan"
  | "gluten-free"
  | "dairy-free"
  | "low-carb";

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

function defaultMealType(now: Date): MealType {
  const h = now.getHours();
  if (h >= 7 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  return "dinner";
}

function getStoredDiet(): Diet {
  if (typeof window === "undefined") return "none";
  try {
    const v = window.localStorage.getItem("dietary_preference") ?? "";
    const value = v.trim().toLowerCase();
    if (
      value === "none" ||
      value === "vegetarian" ||
      value === "vegan" ||
      value === "gluten-free" ||
      value === "dairy-free" ||
      value === "low-carb"
    ) {
      return value;
    }
    return "none";
  } catch {
    return "none";
  }
}

function setStoredDiet(value: Diet) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("dietary_preference", value);
  } catch {}
}

function readJsonFromStorage(key: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function getStoredFilters() {
  const data = readJsonFromStorage("recipes:lastFilters");
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;

  const mealType =
    obj.mealType === "breakfast" ||
    obj.mealType === "lunch" ||
    obj.mealType === "dinner"
      ? (obj.mealType as MealType)
      : null;
  const who =
    obj.who === "adults" || obj.who === "kids" ? (obj.who as Who) : null;
  const servingsRaw = Number(obj.servings);
  const servings =
    Number.isFinite(servingsRaw) && [1, 2, 3, 4].includes(servingsRaw)
      ? (servingsRaw as Servings)
      : null;
  const diet =
    obj.diet === "none" ||
    obj.diet === "vegetarian" ||
    obj.diet === "vegan" ||
    obj.diet === "gluten-free" ||
    obj.diet === "dairy-free" ||
    obj.diet === "low-carb"
      ? (obj.diet as Diet)
      : null;

  return { mealType, who, servings, diet };
}

function getStoredRecipes(): Recipe[] {
  const data = readJsonFromStorage("recipes:lastResults");
  if (!Array.isArray(data)) return [];
  return data as Recipe[];
}

export function RecipesClient() {
  const router = useRouter();
  const [mealType, setMealType] = useState<MealType>(() => {
    const stored = getStoredFilters();
    return stored?.mealType ?? defaultMealType(new Date());
  });
  const [who, setWho] = useState<Who>(() => {
    const stored = getStoredFilters();
    return stored?.who ?? "adults";
  });
  const [servings, setServings] = useState<Servings>(() => {
    const stored = getStoredFilters();
    return stored?.servings ?? 2;
  });
  const [diet, setDiet] = useState<Diet>(() => {
    const stored = getStoredFilters();
    return stored?.diet ?? getStoredDiet();
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>(() => getStoredRecipes());

  useEffect(() => {
    setStoredDiet(diet);
  }, [diet]);

  const subtitle = useMemo(() => {
    const whoLabel = who === "kids" ? "Kids" : "Adults";
    const mealLabel =
      mealType === "breakfast"
        ? "Breakfast"
        : mealType === "lunch"
        ? "Lunch"
        : "Dinner";
    return `${mealLabel} • ${whoLabel} • Servings ${servings}`;
  }, [mealType, servings, who]);

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <div className="text-sm font-medium">Filters</div>
            <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="mealType">Meal type</Label>
            <Select
              id="mealType"
              value={mealType}
              onChange={(e) => setMealType(e.currentTarget.value as MealType)}
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="who">Who’s eating</Label>
            <Select
              id="who"
              value={who}
              onChange={(e) => setWho(e.currentTarget.value as Who)}
            >
              <option value="adults">Adults</option>
              <option value="kids">Kids</option>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="servings">Servings</Label>
            <Select
              id="servings"
              value={String(servings)}
              onChange={(e) =>
                setServings(Number(e.currentTarget.value) as Servings)
              }
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4+</option>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="diet">Dietary preference</Label>
            <Select
              id="diet"
              value={diet}
              onChange={(e) => setDiet(e.currentTarget.value as Diet)}
            >
              <option value="none">None</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan</option>
              <option value="gluten-free">Gluten-free</option>
              <option value="dairy-free">Dairy-free</option>
              <option value="low-carb">Low-carb</option>
            </Select>
          </div>

          <Button
            type="button"
            className="w-full"
            disabled={loading}
            onClick={async () => {
              setError(null);
              setRecipes([]);
              setLoading(true);
              try {
                const res = await fetch("/api/recipes/ai", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ mealType, who, diet, servings }),
                });
                const data = (await res.json()) as unknown;
                if (!res.ok) {
                  const msg =
                    data && typeof data === "object" && "error" in data
                      ? String(
                          (data as { error?: unknown }).error ??
                            "Recipe search failed."
                        )
                      : "Recipe search failed.";
                  setError(msg);
                  return;
                }
                const list =
                  data && typeof data === "object" && "recipes" in data
                    ? (data as { recipes?: unknown }).recipes
                    : null;
                if (!Array.isArray(list)) {
                  setError("Recipe search failed.");
                  return;
                }
                const next = list as Recipe[];
                setRecipes(next);
                try {
                  window.localStorage.setItem(
                    "recipes:lastFilters",
                    JSON.stringify({ mealType, who, diet, servings })
                  );
                  window.localStorage.setItem(
                    "recipes:lastResults",
                    JSON.stringify(next)
                  );
                } catch {}
              } catch {
                setError("Recipe search failed.");
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? "Finding recipes…" : "Find recipes"}
          </Button>
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      {recipes.length ? (
        <div className="grid grid-cols-1 gap-3">
          {recipes.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border bg-muted">
                  {r.imageUrl ? (
                    <Image
                      src={r.imageUrl}
                      alt={r.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">
                      {r.timeMinutes}m
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{r.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>•</span>
                    <span>Serves {r.servings}</span>
                    <span>•</span>
                    <span>{r.description}</span>
                    <span>•</span>
                    <span>{r.pantryCoverage}% pantry</span>
                    {r.macrosPerServing ? (
                      <>
                        <span>•</span>
                        <MacroSummary macros={r.macrosPerServing} showSugar />
                      </>
                    ) : null}
                    {r.missingIngredients.length ? (
                      <>
                        <span>•</span>
                        <span>Missing: {r.missingIngredients.join(", ")}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                className="shrink-0"
                onClick={() => {
                  router.push(`/recipes/${encodeURIComponent(r.id)}`);
                }}
              >
                View
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

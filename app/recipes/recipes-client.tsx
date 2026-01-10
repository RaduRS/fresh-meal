"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import Image from "next/image";

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
  id: number;
  title: string;
  image: string | null;
  sourceUrl: string | null;
  readyInMinutes: number | null;
  servings: number | null;
  missedCount: number;
  missedIngredients: string[];
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

export function RecipesClient() {
  const [mealType, setMealType] = useState<MealType>(() =>
    defaultMealType(new Date())
  );
  const [who, setWho] = useState<Who>("adults");
  const [servings, setServings] = useState<Servings>(2);
  const [diet, setDiet] = useState<Diet>(() => getStoredDiet());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);

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
                const res = await fetch("/api/recipes/search", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ mealType, diet, servings }),
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
                setRecipes(list as Recipe[]);
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
                  {r.image ? (
                    <Image
                      src={r.image}
                      alt={r.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : null}
                </div>

                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{r.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    {typeof r.readyInMinutes === "number" ? (
                      <span>{r.readyInMinutes} min</span>
                    ) : null}
                    {typeof r.servings === "number" ? <span>•</span> : null}
                    {typeof r.servings === "number" ? (
                      <span>Serves {r.servings}</span>
                    ) : null}
                    <span>•</span>
                    <span>
                      Missing {r.missedCount}
                      {r.missedIngredients.length
                        ? `: ${r.missedIngredients.join(", ")}`
                        : ""}
                    </span>
                  </div>
                </div>
              </div>

              {r.sourceUrl ? (
                <Button asChild variant="secondary" className="shrink-0">
                  <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                    View
                  </a>
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

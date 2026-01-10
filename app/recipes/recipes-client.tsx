"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
              setLoading(true);
              await new Promise((r) => setTimeout(r, 250));
              setLoading(false);
            }}
          >
            {loading ? "Finding recipes…" : "Find recipes"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        Next step: hook this button to Spoonacular + Gemini ranking.
      </div>
    </div>
  );
}

import { NextResponse } from "next/server";

import { listPantryItems } from "@/lib/pantry";
import { generateRecipesFromPantry } from "@/lib/ai/recipes";
import { ensureRecipeImage } from "@/lib/recipe-images";

export const runtime = "nodejs";

type MealType = "breakfast" | "lunch" | "dinner";
type Who = "adults" | "kids";
type Diet =
  | "none"
  | "vegetarian"
  | "vegan"
  | "gluten-free"
  | "dairy-free"
  | "low-carb";

type RequestBody = {
  mealType: MealType;
  who: Who;
  diet: Diet;
  servings: number;
  maxTimeMinutes: number | null;
};

function canonicalize(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStringsByCanonical(input: string[], max: number) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of input) {
    const key = canonicalize(s);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function pickPantryImageUrl(
  ingredientName: string,
  pantry: Array<{ name: string; image_url: string | null }>
) {
  const target = canonicalize(ingredientName);
  if (!target) return null;

  let best: { imageUrl: string; score: number } | null = null;

  for (const p of pantry) {
    if (!p.image_url) continue;
    const key = canonicalize(p.name);
    if (!key) continue;

    let score = 0;
    if (key === target) score = 100;
    else if (key.includes(target))
      score = 70 - Math.min(30, key.length - target.length);
    else if (target.includes(key))
      score = 60 - Math.min(30, target.length - key.length);
    else continue;

    if (!best || score > best.score) {
      best = { imageUrl: p.image_url, score };
      if (score >= 100) break;
    }
  }

  return best?.imageUrl ?? null;
}

function pickPantryMacroSource(
  ingredientName: string,
  pantry: Array<{
    name: string;
    calories_kcal_100g: number | null;
    protein_g_100g: number | null;
    carbs_g_100g: number | null;
    fat_g_100g: number | null;
    sugar_g_100g: number | null;
  }>
) {
  const target = canonicalize(ingredientName);
  if (!target) return null;

  let best: { item: (typeof pantry)[number]; score: number } | null = null;
  for (const p of pantry) {
    const key = canonicalize(p.name);
    if (!key) continue;
    let score = 0;
    if (key === target) score = 100;
    else if (key.includes(target))
      score = 70 - Math.min(30, key.length - target.length);
    else if (target.includes(key))
      score = 60 - Math.min(30, target.length - key.length);
    else continue;

    if (!best || score > best.score) {
      best = { item: p, score };
      if (score >= 100) break;
    }
  }
  return best?.item ?? null;
}

function computeRecipeMacrosPerServing(input: {
  servings: number;
  ingredientAmountsG: Array<{ name: string; amountG: number }>;
  pantry: Array<{
    name: string;
    calories_kcal_100g: number | null;
    protein_g_100g: number | null;
    carbs_g_100g: number | null;
    fat_g_100g: number | null;
    sugar_g_100g: number | null;
  }>;
}) {
  let any = false;
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let sugar = 0;

  for (const ing of input.ingredientAmountsG) {
    const amountG = Number(ing.amountG);
    if (!Number.isFinite(amountG) || amountG <= 0) continue;
    const p = pickPantryMacroSource(ing.name, input.pantry);
    if (!p) continue;
    if (
      typeof p.calories_kcal_100g !== "number" ||
      typeof p.protein_g_100g !== "number" ||
      typeof p.carbs_g_100g !== "number" ||
      typeof p.fat_g_100g !== "number" ||
      typeof p.sugar_g_100g !== "number"
    ) {
      continue;
    }
    const f = amountG / 100;
    calories += p.calories_kcal_100g * f;
    protein += p.protein_g_100g * f;
    carbs += p.carbs_g_100g * f;
    fat += p.fat_g_100g * f;
    sugar += p.sugar_g_100g * f;
    any = true;
  }

  if (!any) return null;

  const servings = Math.max(1, Math.floor(Number(input.servings) || 1));
  const per = (n: number) => Math.round((n / servings) * 10) / 10;
  return {
    caloriesKcal: Math.round(calories / servings),
    proteinG: per(protein),
    carbsG: per(carbs),
    fatG: per(fat),
    sugarG: per(sugar),
  };
}

function readBody(data: unknown): RequestBody | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;

  const mealTypeRaw = typeof obj.mealType === "string" ? obj.mealType : "";
  const mealType =
    mealTypeRaw === "breakfast" ||
    mealTypeRaw === "lunch" ||
    mealTypeRaw === "dinner"
      ? mealTypeRaw
      : null;

  const whoRaw = typeof obj.who === "string" ? obj.who : "";
  const who = whoRaw === "adults" || whoRaw === "kids" ? whoRaw : "adults";

  const dietRaw = typeof obj.diet === "string" ? obj.diet : "";
  const diet: Diet =
    dietRaw === "none" ||
    dietRaw === "vegetarian" ||
    dietRaw === "vegan" ||
    dietRaw === "gluten-free" ||
    dietRaw === "dairy-free" ||
    dietRaw === "low-carb"
      ? dietRaw
      : "none";

  const servingsRaw = Number(obj.servings);
  const servings = Number.isFinite(servingsRaw)
    ? Math.max(1, Math.floor(servingsRaw))
    : 2;

  const maxTimeMinutesRaw = Number(obj.maxTimeMinutes);
  const maxTimeMinutes =
    obj.maxTimeMinutes === null || typeof obj.maxTimeMinutes === "undefined"
      ? null
      : Number.isFinite(maxTimeMinutesRaw)
      ? Math.max(5, Math.min(180, Math.floor(maxTimeMinutesRaw)))
      : 15;

  if (!mealType) return null;
  return { mealType, who, diet, servings, maxTimeMinutes };
}

export async function POST(req: Request) {
  const raw = (await req.json().catch(() => null)) as unknown;
  const body = readBody(raw);
  if (!body) {
    return NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  const pantry = await listPantryItems();
  const pantryForAi = pantry
    .map((p) => ({
      name: p.name,
      quantity: p.quantity,
      quantityUnit: p.quantity_unit,
      nutritionPer100g:
        typeof p.calories_kcal_100g === "number" &&
        typeof p.protein_g_100g === "number" &&
        typeof p.carbs_g_100g === "number" &&
        typeof p.fat_g_100g === "number" &&
        typeof p.sugar_g_100g === "number"
          ? {
              caloriesKcal: p.calories_kcal_100g,
              proteinG: p.protein_g_100g,
              carbsG: p.carbs_g_100g,
              fatG: p.fat_g_100g,
              sugarG: p.sugar_g_100g,
            }
          : null,
    }))
    .filter((p) => Boolean(p.name && p.name.trim()))
    .slice(0, 120);

  const pantryNames = pantryForAi.map((p) => p.name).filter(Boolean);
  if (pantryNames.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No pantry items found." },
      { status: 400 }
    );
  }

  try {
    const recipes = await generateRecipesFromPantry({
      pantryItems: pantryForAi,
      mealType: body.mealType,
      who: body.who,
      servings: body.servings,
      diet: body.diet,
      maxTimeMinutes: body.maxTimeMinutes,
    });

    const withImages = await Promise.all(
      recipes.map(async (r) => {
        const ingredientsUsed = uniqueStringsByCanonical(r.ingredientsUsed, 14);
        const displayNameForKey = new Map<string, string>();
        for (const name of ingredientsUsed) {
          const key = canonicalize(name);
          if (!key) continue;
          displayNameForKey.set(key, name);
        }

        const imageUrl = await ensureRecipeImage({
          id: r.id,
          title: r.title,
          description: r.description,
        }).catch(() => null);

        const amountsByKey = new Map<
          string,
          {
            amountG: number;
            quantity: number | null;
            quantityUnit: "count" | "g" | "ml" | null;
          }
        >();
        for (const a of r.ingredientAmountsG) {
          const k = canonicalize(a.name);
          if (!k) continue;
          if (!displayNameForKey.has(k)) continue;
          const v = Number(a.amountG);
          if (!Number.isFinite(v) || v <= 0) continue;
          const existing = amountsByKey.get(k);
          const nextAmountG = (existing?.amountG ?? 0) + v;
          const quantityRaw =
            typeof a.quantity === "number" ? a.quantity : null;
          const quantity =
            typeof quantityRaw === "number" &&
            Number.isFinite(quantityRaw) &&
            quantityRaw > 0
              ? quantityRaw
              : null;
          const quantityUnit =
            a.quantityUnit === "count" ||
            a.quantityUnit === "g" ||
            a.quantityUnit === "ml"
              ? a.quantityUnit
              : null;

          if (!existing) {
            amountsByKey.set(k, {
              amountG: nextAmountG,
              quantity,
              quantityUnit,
            });
            continue;
          }

          const mergedUnit =
            existing.quantityUnit && quantityUnit
              ? existing.quantityUnit === quantityUnit
                ? existing.quantityUnit
                : null
              : existing.quantityUnit ?? quantityUnit;
          const mergedQuantity =
            typeof existing.quantity === "number" &&
            typeof quantity === "number" &&
            mergedUnit
              ? existing.quantity + quantity
              : existing.quantity ?? quantity;
          amountsByKey.set(k, {
            amountG: nextAmountG,
            quantity: mergedQuantity,
            quantityUnit: mergedUnit,
          });
        }
        const ingredientAmountsG = ingredientsUsed
          .map((name) => {
            const k = canonicalize(name);
            const entry = k ? amountsByKey.get(k) : null;
            if (!entry) return null;
            const amountG = Math.round(entry.amountG);
            if (amountG <= 0) return null;
            return {
              name,
              amountG,
              quantity: entry.quantity,
              quantityUnit: entry.quantityUnit,
            };
          })
          .filter(
            (
              x
            ): x is {
              name: string;
              amountG: number;
              quantity: number | null;
              quantityUnit: "count" | "g" | "ml" | null;
            } => x !== null
          )
          .slice(0, 14);

        const ingredientsUsedDetailed = ingredientsUsed.map((name) => {
          const k = canonicalize(name);
          const entry = k ? amountsByKey.get(k) : null;
          return {
            name,
            imageUrl: pickPantryImageUrl(name, pantry),
            amountG: typeof entry?.amountG === "number" ? entry.amountG : null,
            quantity: entry?.quantity ?? null,
            quantityUnit: entry?.quantityUnit ?? null,
          };
        });
        const macrosPerServing = computeRecipeMacrosPerServing({
          servings: r.servings,
          ingredientAmountsG: ingredientAmountsG.map((a) => ({
            name: a.name,
            amountG: a.amountG,
          })),
          pantry,
        });
        return {
          ...r,
          ingredientsUsed,
          ingredientAmountsG,
          imageUrl,
          ingredientsUsedDetailed,
          macrosPerServing,
        };
      })
    );

    return NextResponse.json({
      ok: true,
      recipes: withImages,
      pantryCount: pantryNames.length,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "AI recipe generation failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

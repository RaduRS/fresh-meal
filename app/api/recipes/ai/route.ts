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
};

function canonicalize(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

  if (!mealType) return null;
  return { mealType, who, diet, servings };
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
  const pantryItems = pantry.map((p) => p.name).filter(Boolean);
  if (pantryItems.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No pantry items found." },
      { status: 400 }
    );
  }

  try {
    const recipes = await generateRecipesFromPantry({
      pantryItems,
      mealType: body.mealType,
      who: body.who,
      servings: body.servings,
      diet: body.diet,
    });

    const withImages = await Promise.all(
      recipes.map(async (r) => {
        const imageUrl = await ensureRecipeImage({
          id: r.id,
          title: r.title,
          description: r.description,
        }).catch(() => null);
        const ingredientsUsedDetailed = r.ingredientsUsed.map((name) => ({
          name,
          imageUrl: pickPantryImageUrl(name, pantry),
        }));
        return { ...r, imageUrl, ingredientsUsedDetailed };
      })
    );

    return NextResponse.json({
      ok: true,
      recipes: withImages,
      pantryCount: pantryItems.length,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "AI recipe generation failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

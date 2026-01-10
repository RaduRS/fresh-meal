import { NextResponse } from "next/server";

import { listPantryItems } from "@/lib/pantry";

type MealType = "breakfast" | "lunch" | "dinner";
type Diet =
  | "none"
  | "vegetarian"
  | "vegan"
  | "gluten-free"
  | "dairy-free"
  | "low-carb";

type RequestBody = {
  mealType: MealType;
  diet: Diet;
  servings: number;
};

type SpoonacularFindByIngredientsItem = {
  id: number;
  title: string;
  image: string | null;
  missedIngredientCount: number;
  missedIngredients?: Array<{ name: string }>;
};

type SpoonacularInfoItem = {
  id: number;
  sourceUrl?: string;
  readyInMinutes?: number;
  servings?: number;
  diets?: string[];
  dishTypes?: string[];
  image?: string;
};

function readBody(data: unknown): RequestBody | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const mealTypeRaw = typeof obj.mealType === "string" ? obj.mealType : "";
  const dietRaw = typeof obj.diet === "string" ? obj.diet : "";
  const servingsRaw = Number(obj.servings);
  const mealType =
    mealTypeRaw === "breakfast" ||
    mealTypeRaw === "lunch" ||
    mealTypeRaw === "dinner"
      ? mealTypeRaw
      : null;
  const diet: Diet =
    dietRaw === "none" ||
    dietRaw === "vegetarian" ||
    dietRaw === "vegan" ||
    dietRaw === "gluten-free" ||
    dietRaw === "dairy-free" ||
    dietRaw === "low-carb"
      ? dietRaw
      : "none";
  const servings = Number.isFinite(servingsRaw)
    ? Math.max(1, Math.floor(servingsRaw))
    : 2;
  if (!mealType) return null;
  return { mealType, diet, servings };
}

function normalizeDietForSpoonacular(diet: Diet) {
  if (diet === "none") return null;
  if (diet === "gluten-free") return "gluten free";
  if (diet === "dairy-free") return "dairy free";
  if (diet === "low-carb") return "low carb";
  return diet;
}

function matchesMealType(info: SpoonacularInfoItem, mealType: MealType) {
  const dishTypes = (info.dishTypes ?? []).map((v) => v.toLowerCase());
  if (dishTypes.includes(mealType)) return true;
  return false;
}

function matchesDiet(info: SpoonacularInfoItem, diet: Diet) {
  const expected = normalizeDietForSpoonacular(diet);
  if (!expected) return true;
  const diets = (info.diets ?? []).map((v) => v.toLowerCase());
  return diets.includes(expected);
}

export async function POST(req: Request) {
  const apiKey = process.env.SPOONACULAR_API_KEY?.trim() || null;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "Missing SPOONACULAR_API_KEY" },
      { status: 500 }
    );
  }

  const raw = (await req.json().catch(() => null)) as unknown;
  const body = readBody(raw);
  if (!body) {
    return NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  const pantry = await listPantryItems();
  const ingredients = pantry
    .map((p) => p.name.trim())
    .filter(Boolean)
    .slice(0, 30);

  if (ingredients.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No pantry items found." },
      { status: 400 }
    );
  }

  const ingredientsParam = encodeURIComponent(ingredients.join(","));
  const findUrl = `https://api.spoonacular.com/recipes/findByIngredients?apiKey=${encodeURIComponent(
    apiKey
  )}&ingredients=${ingredientsParam}&number=15&ranking=2&ignorePantry=false`;

  const findRes = await fetch(findUrl, { next: { revalidate: 60 } });
  const findJson = (await findRes.json().catch(() => null)) as unknown;
  if (!findRes.ok || !Array.isArray(findJson)) {
    return NextResponse.json(
      { ok: false, error: "Recipe search failed." },
      { status: 502 }
    );
  }

  const found = (findJson as SpoonacularFindByIngredientsItem[]).filter(
    (r) => r && typeof r.id === "number" && typeof r.title === "string"
  );

  const ids = found.map((r) => r.id).slice(0, 15);
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, recipes: [] });
  }

  const bulkUrl = `https://api.spoonacular.com/recipes/informationBulk?apiKey=${encodeURIComponent(
    apiKey
  )}&ids=${encodeURIComponent(ids.join(","))}&includeNutrition=false`;
  const bulkRes = await fetch(bulkUrl, { next: { revalidate: 60 } });
  const bulkJson = (await bulkRes.json().catch(() => null)) as unknown;
  if (!bulkRes.ok || !Array.isArray(bulkJson)) {
    return NextResponse.json(
      { ok: false, error: "Recipe details failed." },
      { status: 502 }
    );
  }

  const infoById = new Map<number, SpoonacularInfoItem>();
  for (const v of bulkJson as SpoonacularInfoItem[]) {
    if (!v || typeof v !== "object") continue;
    if (typeof v.id !== "number") continue;
    infoById.set(v.id, v);
  }

  const allRecipes = found.map((r) => {
    const info = infoById.get(r.id);
    return {
      id: r.id,
      title: r.title,
      image: (info?.image ?? r.image ?? null) as string | null,
      sourceUrl: (info?.sourceUrl ?? null) as string | null,
      readyInMinutes:
        typeof info?.readyInMinutes === "number" ? info.readyInMinutes : null,
      servings: typeof info?.servings === "number" ? info.servings : null,
      missedCount:
        typeof r.missedIngredientCount === "number"
          ? r.missedIngredientCount
          : 0,
      missedIngredients: Array.isArray(r.missedIngredients)
        ? r.missedIngredients
            .map((m) => (m && typeof m.name === "string" ? m.name.trim() : ""))
            .filter(Boolean)
            .slice(0, 6)
        : [],
      diets: Array.isArray(info?.diets)
        ? info.diets
            .map((d) => (typeof d === "string" ? d : ""))
            .filter(Boolean)
        : [],
      dishTypes: Array.isArray(info?.dishTypes)
        ? info.dishTypes
            .map((d) => (typeof d === "string" ? d : ""))
            .filter(Boolean)
        : [],
    };
  });

  const withServings = allRecipes.filter((r) => {
    const info = infoById.get(r.id);
    if (!info) return true;
    if (typeof info.servings === "number" && Number.isFinite(info.servings)) {
      if (info.servings < body.servings) return false;
    }
    return true;
  });

  const withDiet = withServings.filter((r) => {
    const info = infoById.get(r.id);
    if (!info) return true;
    return matchesDiet(info, body.diet);
  });

  const withMealType = withDiet.filter((r) => {
    const info = infoById.get(r.id);
    if (!info) return true;
    return matchesMealType(info, body.mealType);
  });

  const recipes =
    withMealType.length > 0 ? withMealType.slice(0, 10) : withDiet.slice(0, 10);

  return NextResponse.json({
    ok: true,
    pantryCount: ingredients.length,
    recipes,
  });
}

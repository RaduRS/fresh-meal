import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { normalizePantryItemName } from "@/lib/ai/item-name";
import { suggestPantryCategory } from "@/lib/ai/category";
import { insertPantryItem } from "@/lib/pantry";
import { ensurePantryItemImage } from "@/lib/pantry-images";

type AddItemInput = {
  name: string;
  quantity: number;
  quantityUnit: "count" | "g" | "ml";
  nutritionPer100g: {
    caloriesKcal: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    sugarG: number | null;
  } | null;
};

function parseAmount(input: { quantity: unknown; quantityUnit: unknown }): {
  quantity: number;
  quantityUnit: "count" | "g" | "ml";
} {
  const unitRaw =
    typeof input.quantityUnit === "string" ? input.quantityUnit.trim() : "";
  const directUnit =
    unitRaw === "g" || unitRaw === "ml" || unitRaw === "count"
      ? (unitRaw as "count" | "g" | "ml")
      : null;

  const numericQty = Number(input.quantity);
  if (directUnit) {
    const q = Number.isFinite(numericQty) ? numericQty : 1;
    return {
      quantity: Math.max(0, Math.round(q * 100) / 100),
      quantityUnit: directUnit,
    };
  }

  if (typeof input.quantity === "string") {
    const text = input.quantity.trim().toLowerCase();
    const m = text.match(/^(\d+(?:\.\d+)?)\s*(kg|g|l|ml|count)?$/);
    if (m) {
      const value = Number(m[1]);
      const u = m[2] ?? "";
      if (Number.isFinite(value)) {
        if (u === "kg")
          return { quantity: Math.round(value * 1000), quantityUnit: "g" };
        if (u === "g")
          return { quantity: Math.round(value), quantityUnit: "g" };
        if (u === "l")
          return { quantity: Math.round(value * 1000), quantityUnit: "ml" };
        if (u === "ml")
          return { quantity: Math.round(value), quantityUnit: "ml" };
        if (u === "count")
          return { quantity: Math.max(0, value), quantityUnit: "count" };
      }
    }
  }

  const fallback = Number.isFinite(numericQty) ? numericQty : 1;
  return {
    quantity: Math.max(0, Math.round(fallback * 100) / 100),
    quantityUnit: "count",
  };
}

function clampNutrition(nutritionRaw: Record<string, unknown>) {
  const caloriesRaw = nutritionRaw.caloriesKcal;
  const caloriesKcal =
    typeof caloriesRaw === "number" && caloriesRaw >= 0 && caloriesRaw <= 900
      ? caloriesRaw
      : null;
  const proteinRaw = nutritionRaw.proteinG;
  const proteinG =
    typeof proteinRaw === "number" && proteinRaw >= 0 && proteinRaw <= 100
      ? proteinRaw
      : null;
  const carbsRaw = nutritionRaw.carbsG;
  const carbsG =
    typeof carbsRaw === "number" && carbsRaw >= 0 && carbsRaw <= 100
      ? carbsRaw
      : null;
  const fatRaw = nutritionRaw.fatG;
  const fatG =
    typeof fatRaw === "number" && fatRaw >= 0 && fatRaw <= 100 ? fatRaw : null;
  const sugarRaw = nutritionRaw.sugarG;
  const sugarG =
    typeof sugarRaw === "number" && sugarRaw >= 0 && sugarRaw <= 100
      ? sugarRaw
      : null;

  if (
    caloriesKcal === null &&
    proteinG === null &&
    carbsG === null &&
    fatG === null &&
    sugarG === null
  )
    return null;

  return { caloriesKcal, proteinG, carbsG, fatG, sugarG };
}

function requireNutritionPer100g(nutrition: AddItemInput["nutritionPer100g"]) {
  if (!nutrition) return null;
  if (
    typeof nutrition.caloriesKcal !== "number" ||
    typeof nutrition.proteinG !== "number" ||
    typeof nutrition.carbsG !== "number" ||
    typeof nutrition.fatG !== "number" ||
    typeof nutrition.sugarG !== "number"
  )
    return null;
  return nutrition as {
    caloriesKcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    sugarG: number;
  };
}

function readItems(data: unknown): AddItemInput[] | null {
  if (!data || typeof data !== "object") return null;
  if (!("items" in data)) return null;
  const raw = (data as Record<string, unknown>).items;
  if (!Array.isArray(raw)) return null;

  const items: AddItemInput[] = [];
  for (const v of raw) {
    if (!v || typeof v !== "object") continue;
    const obj = v as Record<string, unknown>;
    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    const amount = parseAmount({
      quantity: obj.quantity,
      quantityUnit: obj.quantityUnit,
    });
    const nutritionRaw =
      obj.nutritionPer100g && typeof obj.nutritionPer100g === "object"
        ? (obj.nutritionPer100g as Record<string, unknown>)
        : null;
    const nutritionPer100g = nutritionRaw ? clampNutrition(nutritionRaw) : null;
    if (!name) continue;
    items.push({
      name,
      quantity: amount.quantity,
      quantityUnit: amount.quantityUnit,
      nutritionPer100g,
    });
  }

  return items.slice(0, 50);
}

export async function POST(req: Request) {
  try {
    const data = (await req.json()) as unknown;
    const items = readItems(data);
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items to add." }, { status: 400 });
    }

    let added = 0;
    for (const item of items) {
      const nutritionPer100g = requireNutritionPer100g(item.nutritionPer100g);
      if (!nutritionPer100g) {
        return NextResponse.json(
          { error: "Missing macros for one or more items." },
          { status: 400 }
        );
      }

      const name = await normalizePantryItemName(item.name);
      if (!name) continue;
      const category = await suggestPantryCategory(name);
      const id = await insertPantryItem({
        name,
        category,
        quantity: item.quantity,
        quantityUnit: item.quantityUnit,
        caloriesKcal100g: nutritionPer100g.caloriesKcal,
        proteinG100g: nutritionPer100g.proteinG,
        carbsG100g: nutritionPer100g.carbsG,
        fatG100g: nutritionPer100g.fatG,
        sugarG100g: nutritionPer100g.sugarG,
      });
      if (id) {
        await ensurePantryItemImage({ id }).catch(() => null);
      }
      added += 1;
    }

    revalidatePath("/inventory");
    return NextResponse.json({ ok: true, added });
  } catch {
    return NextResponse.json(
      { error: "Could not save items. Try again." },
      { status: 500 }
    );
  }
}

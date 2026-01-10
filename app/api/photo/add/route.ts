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
    const quantityRaw = Number(obj.quantity);
    const quantity = Number.isFinite(quantityRaw)
      ? Math.max(0, Math.round(quantityRaw * 100) / 100)
      : 1;
    const unitRaw =
      typeof obj.quantityUnit === "string" ? obj.quantityUnit.trim() : "";
    const quantityUnit =
      unitRaw === "g" || unitRaw === "ml" || unitRaw === "count"
        ? unitRaw
        : "count";
    const nutritionRaw =
      obj.nutritionPer100g && typeof obj.nutritionPer100g === "object"
        ? (obj.nutritionPer100g as Record<string, unknown>)
        : null;
    const nutritionPer100g = nutritionRaw
      ? {
          caloriesKcal:
            typeof nutritionRaw.caloriesKcal === "number"
              ? nutritionRaw.caloriesKcal
              : null,
          proteinG:
            typeof nutritionRaw.proteinG === "number"
              ? nutritionRaw.proteinG
              : null,
          carbsG:
            typeof nutritionRaw.carbsG === "number"
              ? nutritionRaw.carbsG
              : null,
          fatG:
            typeof nutritionRaw.fatG === "number" ? nutritionRaw.fatG : null,
          sugarG:
            typeof nutritionRaw.sugarG === "number"
              ? nutritionRaw.sugarG
              : null,
        }
      : null;
    if (!name) continue;
    items.push({ name, quantity, quantityUnit, nutritionPer100g });
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
      const name = await normalizePantryItemName(item.name);
      if (!name) continue;
      const category = await suggestPantryCategory(name);
      const id = await insertPantryItem({
        name,
        category,
        quantity: item.quantity,
        quantityUnit: item.quantityUnit,
        caloriesKcal100g: item.nutritionPer100g?.caloriesKcal ?? null,
        proteinG100g: item.nutritionPer100g?.proteinG ?? null,
        carbsG100g: item.nutritionPer100g?.carbsG ?? null,
        fatG100g: item.nutritionPer100g?.fatG ?? null,
        sugarG100g: item.nutritionPer100g?.sugarG ?? null,
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

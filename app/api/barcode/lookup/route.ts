import { NextResponse } from "next/server";

import { estimateNutritionPer100gFromText } from "@/lib/ai/pantry-vision";

type OFFProductResponse = {
  status: number;
  product?: {
    product_name?: string;
    product_name_en?: string;
    image_url?: string;
    image_front_url?: string;
    quantity?: string;
    brands?: string;
    nutriments?: Record<string, unknown>;
  };
};

function parseOffQuantity(
  value: string | null | undefined
): { quantity: number; quantityUnit: "g" | "ml" | "count" } | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.toLowerCase().replace(/,/g, ".");

  function toNumber(s: string) {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function unitToBase(unit: string, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) return null;
    if (unit === "g") return { quantity: amount, quantityUnit: "g" as const };
    if (unit === "kg")
      return { quantity: amount * 1000, quantityUnit: "g" as const };
    if (unit === "mg")
      return { quantity: amount / 1000, quantityUnit: "g" as const };
    if (unit === "ml") return { quantity: amount, quantityUnit: "ml" as const };
    if (unit === "l")
      return { quantity: amount * 1000, quantityUnit: "ml" as const };
    if (unit === "cl")
      return { quantity: amount * 10, quantityUnit: "ml" as const };
    if (unit === "dl")
      return { quantity: amount * 100, quantityUnit: "ml" as const };
    return null;
  }

  function round2(n: number) {
    return Math.round(n * 100) / 100;
  }

  const multi = normalized.match(
    /(\d+(?:\.\d+)?)\s*(?:x|×|\*)\s*(\d+(?:\.\d+)?)\s*(kg|g|mg|l|ml|cl|dl)\b/i
  );
  if (multi) {
    const a = toNumber(multi[1]);
    const b = toNumber(multi[2]);
    const unit = multi[3];
    if (typeof a === "number" && typeof b === "number") {
      const base = unitToBase(unit, a * b);
      if (base) return { ...base, quantity: round2(base.quantity) };
    }
  }

  const single = normalized.match(/(\d+(?:\.\d+)?)\s*(kg|g|mg|l|ml|cl|dl)\b/i);
  if (single) {
    const amount = toNumber(single[1]);
    const unit = single[2];
    if (typeof amount === "number") {
      const base = unitToBase(unit, amount);
      if (base) return { ...base, quantity: round2(base.quantity) };
    }
  }

  return null;
}

function pickName(p: OFFProductResponse["product"]) {
  const name = p?.product_name?.trim() || p?.product_name_en?.trim() || "";
  return name;
}

function pickImage(p: OFFProductResponse["product"]) {
  return p?.image_front_url?.trim() || p?.image_url?.trim() || null;
}

function readNumber(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function roundCaloriesKcal(value: number) {
  return Math.max(0, Math.round(value));
}

function roundMacroG(value: number) {
  return Math.max(0, Math.round(value * 10) / 10);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const barcode = (url.searchParams.get("barcode") ?? "").trim();

  if (!/^\d{8,14}$/.test(barcode)) {
    return NextResponse.json({ error: "Invalid barcode." }, { status: 400 });
  }

  const offUrl = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(
    barcode
  )}.json`;

  try {
    const res = await fetch(offUrl, {
      headers: { "User-Agent": "FreshMeal/0.1 (personal)" },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Barcode lookup failed." },
        { status: 502 }
      );
    }

    const data = (await res.json()) as OFFProductResponse;
    if (data.status !== 1 || !data.product) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 }
      );
    }

    const name = pickName(data.product);
    if (!name) {
      return NextResponse.json(
        { error: "Product found, but missing name." },
        { status: 502 }
      );
    }

    const offNutrition = {
      caloriesKcal: readNumber(data.product.nutriments?.["energy-kcal_100g"]),
      proteinG: readNumber(data.product.nutriments?.["proteins_100g"]),
      carbsG: readNumber(data.product.nutriments?.["carbohydrates_100g"]),
      fatG: readNumber(data.product.nutriments?.["fat_100g"]),
      sugarG: readNumber(data.product.nutriments?.["sugars_100g"]),
    };

    const needsAi =
      offNutrition.caloriesKcal === null ||
      offNutrition.proteinG === null ||
      offNutrition.carbsG === null ||
      offNutrition.fatG === null ||
      offNutrition.sugarG === null;

    const aiNutrition = needsAi
      ? await estimateNutritionPer100gFromText({
          name,
          brand: data.product.brands ?? null,
        })
      : null;

    const caloriesKcal =
      offNutrition.caloriesKcal ?? aiNutrition?.caloriesKcal ?? null;
    const proteinG = offNutrition.proteinG ?? aiNutrition?.proteinG ?? null;
    const carbsG = offNutrition.carbsG ?? aiNutrition?.carbsG ?? null;
    const fatG = offNutrition.fatG ?? aiNutrition?.fatG ?? null;
    const sugarG = offNutrition.sugarG ?? aiNutrition?.sugarG ?? null;

    const amount = parseOffQuantity(data.product.quantity);

    return NextResponse.json({
      barcode,
      name,
      imageUrl: pickImage(data.product),
      brand: data.product.brands ?? null,
      quantity: amount?.quantity ?? 1,
      quantityUnit: amount?.quantityUnit ?? "count",
      nutritionPer100g: {
        caloriesKcal:
          typeof caloriesKcal === "number"
            ? roundCaloriesKcal(caloriesKcal)
            : null,
        proteinG: typeof proteinG === "number" ? roundMacroG(proteinG) : null,
        carbsG: typeof carbsG === "number" ? roundMacroG(carbsG) : null,
        fatG: typeof fatG === "number" ? roundMacroG(fatG) : null,
        sugarG: typeof sugarG === "number" ? roundMacroG(sugarG) : null,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Barcode lookup failed." },
      { status: 500 }
    );
  }
}

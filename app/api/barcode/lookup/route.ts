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

    return NextResponse.json({
      barcode,
      name,
      imageUrl: pickImage(data.product),
      brand: data.product.brands ?? null,
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

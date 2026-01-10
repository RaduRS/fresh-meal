import { NextResponse } from "next/server";

type OFFProductResponse = {
  status: number;
  product?: {
    product_name?: string;
    product_name_en?: string;
    image_url?: string;
    image_front_url?: string;
    quantity?: string;
    brands?: string;
    serving_size?: string;
    nutriments?: Record<string, unknown>;
  };
};

function pickName(p: OFFProductResponse["product"]) {
  const name =
    p?.product_name?.trim() ||
    p?.product_name_en?.trim() ||
    "";
  return name;
}

function pickImage(p: OFFProductResponse["product"]) {
  return p?.image_front_url?.trim() || p?.image_url?.trim() || null;
}

function readNumber(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const barcode = (url.searchParams.get("barcode") ?? "").trim();

  if (!/^\d{8,14}$/.test(barcode)) {
    return NextResponse.json({ error: "Invalid barcode." }, { status: 400 });
  }

  const offUrl = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(
    barcode,
  )}.json`;

  try {
    const res = await fetch(offUrl, {
      headers: { "User-Agent": "FreshMeal/0.1 (personal)" },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Barcode lookup failed." },
        { status: 502 },
      );
    }

    const data = (await res.json()) as OFFProductResponse;
    if (data.status !== 1 || !data.product) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 },
      );
    }

    const name = pickName(data.product);
    if (!name) {
      return NextResponse.json(
        { error: "Product found, but missing name." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      barcode,
      name,
      imageUrl: pickImage(data.product),
      brand: data.product.brands ?? null,
      servingSize: data.product.serving_size?.trim() || null,
      nutritionPer100g: {
        caloriesKcal: readNumber(data.product.nutriments?.["energy-kcal_100g"]),
        proteinG: readNumber(data.product.nutriments?.["proteins_100g"]),
        carbsG: readNumber(data.product.nutriments?.["carbohydrates_100g"]),
        fatG: readNumber(data.product.nutriments?.["fat_100g"]),
        sugarG: readNumber(data.product.nutriments?.["sugars_100g"]),
      },
    });
  } catch {
    return NextResponse.json({ error: "Barcode lookup failed." }, { status: 500 });
  }
}

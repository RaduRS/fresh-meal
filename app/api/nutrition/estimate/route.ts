import { NextResponse } from "next/server";

import { estimateNutritionPer100gFromText } from "@/lib/ai/pantry-vision";

export const runtime = "nodejs";

function readBody(
  data: unknown
): { name: string; brand: string | null } | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  const brand =
    typeof obj.brand === "string"
      ? obj.brand.trim()
      : obj.brand === null
      ? null
      : null;
  if (!name) return null;
  return { name, brand };
}

export async function POST(req: Request) {
  try {
    const data = (await req.json()) as unknown;
    const body = readBody(data);
    if (!body) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const nutrition = await estimateNutritionPer100gFromText({
      name: body.name,
      brand: body.brand,
    });

    return NextResponse.json({ nutritionPer100g: nutrition });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not estimate nutrition.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

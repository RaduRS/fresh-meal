type GeminiDetectedItem = {
  name: string;
  quantity: number;
  quantityUnit?: "count" | "g" | "ml";
  nutritionPer100g?: {
    caloriesKcal?: number | null;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
    sugarG?: number | null;
  };
  confidence: number;
};

type GeminiDetectedItemsResponse = {
  items: GeminiDetectedItem[];
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) return null;
  return value.trim();
}

function extractJsonObject(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return cleaned.slice(start, end + 1);
}

function canonicalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function detectPantryItemsFromImage(input: {
  base64: string;
  mimeType: string;
}) {
  const apiKey = getEnv("GEMINI_API_KEY");
  const model = getEnv("GEMINI_MODEL") ?? "gemini-2.5-flash";
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const prompt = `Analyze this photo and identify food items visible. Return ONLY valid JSON with this exact shape:
{"items":[{"name":"Tomatoes","quantity":2,"quantityUnit":"count","nutritionPer100g":{"caloriesKcal":18,"proteinG":0.9,"carbsG":3.9,"fatG":0.2,"sugarG":2.6},"confidence":0.92}]}

Rules:
- items: include only food items you are confident about
- name: for packaged items, return the product name as a single item (include brand if visible). Do not split one package into multiple ingredients
- name: for fresh items, use the most specific common UK name visible (e.g., "Cherry Tomatoes" not just "Tomatoes"), properly capitalized. If unsure, use the generic name
- quantityUnit: one of "count","g","ml". Use "g" or "ml" only if the amount is clearly visible on packaging, otherwise "count"
- quantity: number, use 1 if unclear. If quantityUnit is "g" or "ml", quantity can be a whole number
- nutritionPer100g: include ONLY if you are confident (nutrition label is readable or the food is unambiguous). If unsure, set it to null or omit it. Use grams for macros and kcal for calories
- confidence: number 0 to 1
- do not repeat the same item multiple times; merge duplicates into one item and adjust quantity
- do not include any extra keys or text`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: input.mimeType, data: input.base64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0 },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini error (${res.status}): ${body}`);
  }

  const data = (await res.json()) as GeminiGenerateContentResponse;
  const text = data.candidates?.[0]?.content?.parts?.find(
    (p) => typeof p.text === "string"
  )?.text;

  if (!text) {
    throw new Error("Gemini returned no text");
  }

  const jsonText = extractJsonObject(text);
  if (!jsonText) {
    throw new Error("Gemini returned non-JSON output");
  }

  const parsed = JSON.parse(jsonText) as GeminiDetectedItemsResponse;
  const items = Array.isArray(parsed.items) ? parsed.items : [];

  const deduped = new Map<
    string,
    {
      name: string;
      quantity: number;
      quantityUnit: "count" | "g" | "ml";
      nutritionPer100g:
        | {
            caloriesKcal: number | null;
            proteinG: number | null;
            carbsG: number | null;
            fatG: number | null;
            sugarG: number | null;
          }
        | null;
      confidence: number;
    }
  >();

  for (const item of items) {
    if (typeof item?.name !== "string") continue;
    const name = String(item.name).trim();
    if (!name) continue;

    const q = Number(item.quantity);
    const c = Number(item.confidence);
    const quantity = Number.isFinite(q) ? Math.max(0, Math.round(q * 100) / 100) : 1;
    const unit =
      item.quantityUnit === "g" || item.quantityUnit === "ml" || item.quantityUnit === "count"
        ? item.quantityUnit
        : "count";
    const confidence = Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : 0.8;
    const nutritionRaw =
      item.nutritionPer100g && typeof item.nutritionPer100g === "object"
        ? (item.nutritionPer100g as Record<string, unknown>)
        : null;
    const nutritionPer100g = nutritionRaw
      ? {
          caloriesKcal: Number.isFinite(Number(nutritionRaw.caloriesKcal))
            ? Number(nutritionRaw.caloriesKcal)
            : null,
          proteinG: Number.isFinite(Number(nutritionRaw.proteinG)) ? Number(nutritionRaw.proteinG) : null,
          carbsG: Number.isFinite(Number(nutritionRaw.carbsG)) ? Number(nutritionRaw.carbsG) : null,
          fatG: Number.isFinite(Number(nutritionRaw.fatG)) ? Number(nutritionRaw.fatG) : null,
          sugarG: Number.isFinite(Number(nutritionRaw.sugarG)) ? Number(nutritionRaw.sugarG) : null,
        }
      : null;

    const key = canonicalizeName(name);
    if (!key) continue;

    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, { name, quantity, quantityUnit: unit, nutritionPer100g, confidence });
      continue;
    }

    const mergedNutrition =
      nutritionPer100g &&
      (!existing.nutritionPer100g ||
        Object.values(nutritionPer100g).filter((v) => typeof v === "number").length >
          Object.values(existing.nutritionPer100g).filter((v) => typeof v === "number").length)
        ? nutritionPer100g
        : existing.nutritionPer100g;

    deduped.set(key, {
      name: existing.name.length >= name.length ? existing.name : name,
      quantity: Math.max(existing.quantity, quantity),
      quantityUnit: existing.confidence >= confidence ? existing.quantityUnit : unit,
      nutritionPer100g: mergedNutrition,
      confidence: Math.max(existing.confidence, confidence),
    });
  }

  return { items: Array.from(deduped.values()) };
}

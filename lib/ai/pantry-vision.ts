import { chatCompletions } from "@/lib/ai/chat-completions";
import { getChatProviders } from "@/lib/ai/providers";

type DetectedItem = {
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

type DetectedItemsResponse = {
  items: DetectedItem[];
};

type DetectPantryItemsMeta = {
  provider: "gemini" | "kimi";
  model: string;
};

type DetectPantryItemsResult = {
  items: DetectedItem[];
  meta: DetectPantryItemsMeta;
};

function normalizeBaseUrl(raw: string) {
  const trimmed = raw.trim().replace(/[`"' ]+/g, "");
  return trimmed.replace(/\/+$/, "");
}

function toV1BaseUrl(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (normalized.endsWith("/v1")) return normalized;
  return `${normalized}/v1`;
}

function repairJsonObject(text: string) {
  const extracted = extractJsonObject(text);
  if (!extracted) return null;
  const cleaned = extracted
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/,\s*([}\]])/g, "$1");
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {}

  const withMissingCommasFixed = cleaned.replace(/}\s*{/g, "},{");
  try {
    JSON.parse(withMissingCommasFixed);
    return withMissingCommasFixed;
  } catch {}

  return cleaned;
}

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) return null;
  const trimmed = value.trim();
  const unwrapped = trimmed.replace(/^[`"']+|[`"']+$/g, "").trim();
  return unwrapped.length ? unwrapped : null;
}

function normalizeGeminiModelId(model: string) {
  const trimmed = model.trim();
  return trimmed.startsWith("models/")
    ? trimmed.slice("models/".length)
    : trimmed;
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

export async function estimateNutritionPer100gFromText(input: {
  name: string;
  brand?: string | null;
}) {
  const name = input.name.trim();
  const brand = (input.brand ?? "").trim();
  const prompt = `You are estimating nutrition per 100g for a food product.

Return ONLY valid JSON with this exact shape:
{"caloriesKcal":389,"proteinG":7.0,"carbsG":80.0,"fatG":1.0,"sugarG":0.5}

Rules:
- Values must be numbers (never null)
- Units: kcal for calories; grams for macros; all per 100g
- Use a best-effort typical estimate if exact label values are unknown
- Keep values realistic: protein/carbs/fat/sugar between 0 and 100; calories between 0 and 900

Food:
Name: ${JSON.stringify(name)}
Brand: ${JSON.stringify(brand || null)}`;

  const providers = getChatProviders().sort((a, b) => {
    if (a.provider === b.provider) return 0;
    if (a.provider === "deepseek") return -1;
    return 1;
  });

  const system: { role: "system"; content: string } = {
    role: "system",
    content:
      "Return strictly valid JSON. Do not include markdown, backticks, or extra text.",
  };
  const user: { role: "user"; content: string } = {
    role: "user",
    content: prompt,
  };

  let lastError: unknown = null;
  for (const p of providers) {
    try {
      const out = await chatCompletions({
        apiKey: p.apiKey,
        baseUrl: p.baseUrl,
        model: p.model,
        messages: [system, user],
        temperature: 0,
      });
      const jsonText = extractJsonObject(out);
      if (!jsonText) throw new Error("LLM returned non-JSON output");
      const parsed = JSON.parse(jsonText) as unknown;
      if (!parsed || typeof parsed !== "object")
        throw new Error("LLM returned invalid JSON");
      const obj = parsed as Record<string, unknown>;
      const caloriesKcal = Number(obj.caloriesKcal);
      const proteinG = Number(obj.proteinG);
      const carbsG = Number(obj.carbsG);
      const fatG = Number(obj.fatG);
      const sugarG = Number(obj.sugarG);

      if (
        !Number.isFinite(caloriesKcal) ||
        !Number.isFinite(proteinG) ||
        !Number.isFinite(carbsG) ||
        !Number.isFinite(fatG) ||
        !Number.isFinite(sugarG)
      ) {
        throw new Error("LLM returned non-numeric nutrition values");
      }

      if (
        caloriesKcal < 0 ||
        caloriesKcal > 900 ||
        proteinG < 0 ||
        proteinG > 100 ||
        carbsG < 0 ||
        carbsG > 100 ||
        fatG < 0 ||
        fatG > 100 ||
        sugarG < 0 ||
        sugarG > 100
      ) {
        throw new Error("LLM returned out-of-range nutrition values");
      }

      return { caloriesKcal, proteinG, carbsG, fatG, sugarG };
    } catch (e) {
      lastError = e;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("No AI provider configured");
}

export async function detectPantryItemsFromImage(input: {
  base64: string;
  mimeType: string;
}): Promise<DetectPantryItemsResult> {
  const providerRaw = (getEnv("VISION_PROVIDER") ?? "").toLowerCase();
  const hasGemini = Boolean(getEnv("GEMINI_API_KEY"));
  const providerExplicit = providerRaw === "gemini" || providerRaw === "kimi";
  const provider = providerExplicit
    ? (providerRaw as "gemini" | "kimi")
    : hasGemini
    ? "gemini"
    : "kimi";

  const prompt = `Analyze this photo and identify ALL food and drink items visible. Return ONLY valid JSON with this exact shape:
{"items":[{"name":"Tomatoes","quantity":2,"quantityUnit":"count","confidence":0.92}]}

Rules:
- Aim for high recall: include every distinct item you can identify (up to 30)
- items: include food/drink only (no plates, packaging materials, utensils)
- name (packaged): use the product name and brand if visible; do not split one package into components
- name (fresh): use the most specific common name visible, properly capitalized
- quantityUnit: one of "count","g","ml"
- quantity: number. This is the amount the user has.
- If NET WEIGHT / NET WT / VOLUME is visible, you MUST use "g" or "ml" and set quantity to that number (convert kg->g, L->ml)
- Use quantityUnit="count" only for naturally-counted items (eggs, bananas, apples) OR if packaging clearly specifies a count (e.g., "12 eggs")
- If the item is a LIQUID (milk, juice, water, soda, oil, sauces) and you cannot read volume, use "ml" and estimate a typical size:
  - small bottle/can: 330ml
  - medium bottle: 500ml
  - large bottle/carton: 1000ml
  - family size: 2000ml
- If the item is a PACKAGED DRY GOOD / SOLID (rice, pasta, cereal, flour, cheese, meat) and you cannot read weight, use "g" and estimate a typical size:
  - small pack: 250g
  - standard pack: 500g
  - large bag: 1000g
- If the item is not in original packaging (e.g. opened jar/tupperware/bowl), estimate how much the user has using visible fill level; use "g" for solids and "ml" for liquids.
- merge duplicates; prefer the clearest name; confidence 0.2..1
- output must be compact JSON on a single line; no extra keys/text`;

  function dedupeItems(items: DetectedItem[]) {
    const deduped = new Map<
      string,
      {
        name: string;
        quantity: number;
        quantityUnit: "count" | "g" | "ml";
        confidence: number;
      }
    >();

    for (const item of items) {
      if (typeof item?.name !== "string") continue;
      const name = String(item.name).trim();
      if (!name) continue;

      const q = Number(item.quantity);
      const c = Number(item.confidence);
      const quantity = Number.isFinite(q)
        ? Math.max(0, Math.round(q * 100) / 100)
        : 1;
      const unit =
        item.quantityUnit === "g" ||
        item.quantityUnit === "ml" ||
        item.quantityUnit === "count"
          ? item.quantityUnit
          : "count";
      const confidence = Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : 0.8;

      const key = canonicalizeName(name);
      if (!key) continue;

      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, { name, quantity, quantityUnit: unit, confidence });
        continue;
      }

      const mergedUnit =
        existing.quantityUnit === "count" && unit !== "count"
          ? unit
          : unit === "count" && existing.quantityUnit !== "count"
          ? existing.quantityUnit
          : existing.confidence >= confidence
          ? existing.quantityUnit
          : unit;

      deduped.set(key, {
        name: existing.name.length >= name.length ? existing.name : name,
        quantity: Math.max(existing.quantity, quantity),
        quantityUnit: mergedUnit,
        confidence: Math.max(existing.confidence, confidence),
      });
    }

    return Array.from(deduped.values());
  }

  async function runGemini(): Promise<DetectPantryItemsResult> {
    const apiKey = getEnv("GEMINI_API_KEY");
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
    const model = normalizeGeminiModelId(
      getEnv("GEMINI_VISION_MODEL") ?? "gemini-2.0-flash-exp"
    );
    const baseUrl =
      getEnv("GEMINI_BASE_URL") ?? "https://generativelanguage.googleapis.com";
    const maxTokensRaw = getEnv("GEMINI_VISION_MAX_TOKENS");
    const maxTokens = maxTokensRaw ? Number(maxTokensRaw) : 12000;
    const timeoutMsRaw = getEnv("GEMINI_VISION_TIMEOUT_MS");
    const timeoutMs = timeoutMsRaw ? Number(timeoutMsRaw) : 75_000;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = `${baseUrl.replace(
        /\/+$/,
        ""
      )}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: { mimeType: input.mimeType, data: input.base64 },
                },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: Number.isFinite(maxTokens)
              ? Math.max(300, maxTokens)
              : 600,
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Gemini vision error (${res.status}): ${body}`);
      }

      const data = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .map((p) => p.text)
        .filter(Boolean)
        .join("\n");
      if (!text) throw new Error("Gemini returned no text");

      const jsonText = repairJsonObject(text);
      if (!jsonText) throw new Error("Gemini returned non-JSON output");

      let parsed: DetectedItemsResponse;
      try {
        parsed = JSON.parse(jsonText) as DetectedItemsResponse;
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Could not parse model JSON";
        const snippet =
          typeof text === "string"
            ? text.replace(/\s+/g, " ").slice(0, 400)
            : "";
        throw new Error(
          `Gemini returned invalid JSON: ${message}${
            snippet ? ` (${snippet})` : ""
          }`
        );
      }

      const items = Array.isArray(parsed.items) ? parsed.items : [];
      return { items: dedupeItems(items), meta: { provider: "gemini", model } };
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new Error(`Gemini vision timed out after ${timeoutMs}ms`);
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function runKimi(): Promise<DetectPantryItemsResult> {
    const apiKey = getEnv("KIMI_API_KEY");
    if (!apiKey) throw new Error("Missing KIMI_API_KEY");
    const baseUrl =
      getEnv("KIMI_BASE_URL") ??
      getEnv("MOONSHOT_BASE_URL") ??
      "https://api.moonshot.ai/v1";
    const model =
      getEnv("KIMI_VISION_MODEL") ??
      getEnv("MOONSHOT_VISION_MODEL") ??
      "moonshot-v1-32k-vision-preview";
    const maxTokensRaw = getEnv("KIMI_VISION_MAX_TOKENS");
    const maxTokens = maxTokensRaw ? Number(maxTokensRaw) : 600;
    const timeoutMsRaw = getEnv("KIMI_VISION_TIMEOUT_MS");
    const timeoutMs = timeoutMsRaw ? Number(timeoutMsRaw) : 75_000;

    const url = `${toV1BaseUrl(baseUrl)}/chat/completions`;
    const dataUrl = `data:${input.mimeType};base64,${input.base64}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "Return strictly valid JSON. Do not include markdown, backticks, extra text, or pretty formatting.",
            },
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: dataUrl } },
                { type: "text", text: prompt },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "set_detected_items",
                description: "Return detected pantry items from the image.",
                parameters: {
                  type: "object",
                  additionalProperties: false,
                  required: ["items"],
                  properties: {
                    items: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        required: [
                          "name",
                          "quantity",
                          "quantityUnit",
                          "confidence",
                        ],
                        properties: {
                          name: { type: "string" },
                          quantity: { type: "number" },
                          quantityUnit: {
                            type: "string",
                            enum: ["count", "g", "ml"],
                          },
                          confidence: { type: "number" },
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "set_detected_items" },
          },
          max_tokens: Number.isFinite(maxTokens)
            ? Math.max(300, maxTokens)
            : 1200,
          temperature: 0,
        }),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new Error(`Kimi vision timed out after ${timeoutMs}ms`);
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Kimi vision error (${res.status}): ${body}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
          tool_calls?: Array<{ function?: { arguments?: string } }>;
        };
      }>;
    };
    const toolArgs =
      data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const text =
      typeof toolArgs === "string"
        ? toolArgs
        : data.choices?.[0]?.message?.content;

    if (!text) throw new Error("Kimi returned no text");

    const jsonText = repairJsonObject(text);
    if (!jsonText) throw new Error("Kimi returned non-JSON output");

    let parsed: DetectedItemsResponse;
    try {
      parsed = JSON.parse(jsonText) as DetectedItemsResponse;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not parse model JSON";
      throw new Error(message);
    }
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return { items: dedupeItems(items), meta: { provider: "kimi", model } };
  }

  if (provider === "gemini") {
    try {
      return await runGemini();
    } catch (e) {
      if (!providerExplicit && getEnv("KIMI_API_KEY")) return await runKimi();
      throw e;
    }
  }

  return await runKimi();
}

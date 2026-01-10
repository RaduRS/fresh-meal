type GeminiDetectedItem = {
  name: string;
  quantity: number;
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
{"items":[{"name":"Tomatoes","quantity":2,"confidence":0.92}]}

Rules:
- items: include only food items you are confident about
- name: for packaged items, return the product name as a single item (include brand if visible). Do not split one package into multiple ingredients
- name: for fresh items, use a short common UK name, properly capitalized
- quantity: integer, use 1 if unclear
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
    { name: string; quantity: number; confidence: number }
  >();

  for (const item of items) {
    if (typeof item?.name !== "string") continue;
    const name = String(item.name).trim();
    if (!name) continue;

    const q = Number(item.quantity);
    const c = Number(item.confidence);
    const quantity = Number.isFinite(q) ? Math.max(1, Math.floor(q)) : 1;
    const confidence = Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : 0.8;

    const key = canonicalizeName(name);
    if (!key) continue;

    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, { name, quantity, confidence });
      continue;
    }

    deduped.set(key, {
      name: existing.name.length >= name.length ? existing.name : name,
      quantity: Math.max(existing.quantity, quantity),
      confidence: Math.max(existing.confidence, confidence),
    });
  }

  return { items: Array.from(deduped.values()) };
}

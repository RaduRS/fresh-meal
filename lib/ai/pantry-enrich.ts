import { openAICompatibleChat } from "@/lib/ai/openai-compatible";
import { getChatProviders } from "@/lib/ai/providers";
import { normalizeCategory, pantryCategories } from "@/lib/pantry";

function sanitizeName(value: string) {
  const cleaned = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^"+|"+$/g, "");
  return cleaned.slice(0, 80);
}

function toTitleCase(input: string) {
  const cleaned = sanitizeName(input);
  if (!cleaned) return "";
  return cleaned
    .split(" ")
    .map((w) => {
      const head = w.slice(0, 1).toUpperCase();
      const tail = w.slice(1);
      return `${head}${tail}`;
    })
    .join(" ");
}

function buildPrompt(items: string[]) {
  const options = pantryCategories.join(", ");
  const list = JSON.stringify(items.map((x) => sanitizeName(x)).slice(0, 50));
  return `For each input item name, return a normalized display name and exactly one grocery category from this list: ${options}.

Return ONLY valid JSON, with this shape:
{"items":[{"name":"...","category":"..."}]}

Rules:
- Preserve brand names if present.
- Fix obvious spelling/capitalization.
- Category must be exactly one from the list.
- Output items must be in the same order as input.

Input: ${list}`;
}

export async function enrichPantryItems(inputNames: string[]) {
  const cleaned = inputNames.map((x) => sanitizeName(x));
  const system: { role: "system"; content: string } = {
    role: "system",
    content:
      "Return strictly valid JSON. Do not include markdown, backticks, or extra text.",
  };
  const user: { role: "user"; content: string } = {
    role: "user",
    content: buildPrompt(cleaned),
  };

  for (const p of getChatProviders()) {
    try {
      const out = await openAICompatibleChat({
        apiKey: p.apiKey,
        baseUrl: p.baseUrl,
        model: p.model,
        messages: [system, user],
        temperature: 0,
      });

      const parsed = JSON.parse(out) as unknown;
      if (!parsed || typeof parsed !== "object") continue;
      if (!("items" in parsed)) continue;
      const items = (parsed as Record<string, unknown>).items;
      if (!Array.isArray(items) || items.length !== cleaned.length) continue;

      const result = items.map((v, idx) => {
        const obj = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
        const rawName =
          obj && typeof obj.name === "string" ? sanitizeName(obj.name) : "";
        const rawCategory =
          obj && typeof obj.category === "string" ? obj.category : "Other";
        const name = rawName || toTitleCase(cleaned[idx] ?? "");
        const category = normalizeCategory(String(rawCategory));
        return { name, category };
      });

      if (result.every((x) => x.name)) return result;
    } catch {}
  }

  return cleaned.map((x) => ({ name: toTitleCase(x), category: "Other" as const }));
}


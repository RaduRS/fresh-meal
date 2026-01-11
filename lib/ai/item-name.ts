import { chatCompletions } from "@/lib/ai/chat-completions";
import { getChatProviders } from "@/lib/ai/providers";

function toTitleCase(input: string) {
  const cleaned = input
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^"+|"+$/g, "");

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

function sanitizeName(value: string) {
  const cleaned = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^"+|"+$/g, "");

  return cleaned.slice(0, 80);
}

export async function normalizePantryItemName(rawName: string) {
  const base = sanitizeName(rawName);
  if (!base) return "";

  const system: { role: "system"; content: string } = {
    role: "system",
    content:
      "Normalize a food item name. Fix obvious spelling mistakes and capitalization. Keep brand names if present. Do not split into multiple items. Output only the corrected name, no punctuation or quotes.",
  };

  const user: { role: "user"; content: string } = {
    role: "user",
    content: `Input: ${base}`,
  };

  for (const p of getChatProviders()) {
    try {
      const out = await chatCompletions({
        apiKey: p.apiKey,
        baseUrl: p.baseUrl,
        model: p.model,
        messages: [system, user],
        temperature: 0,
      });
      const normalized = sanitizeName(out);
      if (normalized) return normalized;
    } catch {}
  }

  return toTitleCase(base);
}

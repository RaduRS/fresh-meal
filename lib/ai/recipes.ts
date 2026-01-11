import "server-only";

import crypto from "node:crypto";

import { chatCompletions } from "@/lib/ai/chat-completions";
import { getChatProviders } from "@/lib/ai/providers";

type MealType = "breakfast" | "lunch" | "dinner";
type Who = "adults" | "kids";
type Diet =
  | "none"
  | "vegetarian"
  | "vegan"
  | "gluten-free"
  | "dairy-free"
  | "low-carb";

export type AiRecipe = {
  id: string;
  title: string;
  description: string;
  servings: number;
  timeMinutes: number;
  pantryCoverage: number;
  missingIngredients: string[];
  ingredientsUsed: string[];
  steps: string[];
  imageUrl: string | null;
};

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

function canonicalize(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeId(seed: string) {
  const slug = seed
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const hash = crypto
    .createHash("sha256")
    .update(seed)
    .digest("hex")
    .slice(0, 10);
  return `${slug || "recipe"}-${hash}`;
}

function clampInt(n: unknown, min: number, max: number, fallback: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function cleanString(v: unknown) {
  if (typeof v !== "string") return "";
  return v.trim();
}

function cleanStringList(v: unknown, max: number) {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = cleanString(item);
    if (!s) continue;
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function normalizeDietLabel(diet: Diet) {
  if (diet === "none") return "None";
  if (diet === "gluten-free") return "Gluten-free";
  if (diet === "dairy-free") return "Dairy-free";
  if (diet === "low-carb") return "Low-carb";
  return diet[0].toUpperCase() + diet.slice(1);
}

async function generateTextWithChatProviders(input: { prompt: string }) {
  const providers = getChatProviders().sort((a, b) => {
    if (a.provider === b.provider) return 0;
    if (a.provider === "deepseek") return -1;
    return 1;
  });
  if (providers.length === 0) throw new Error("No AI provider configured");

  const system: { role: "system"; content: string } = {
    role: "system",
    content:
      "Return strictly valid JSON. Do not include markdown, backticks, or extra text.",
  };
  const user: { role: "user"; content: string } = {
    role: "user",
    content: input.prompt,
  };

  let lastError: unknown = null;
  for (const p of providers) {
    try {
      const out = await chatCompletions({
        apiKey: p.apiKey,
        baseUrl: p.baseUrl,
        model: p.model,
        messages: [system, user],
        temperature: 0.4,
      });
      return out;
    } catch (e) {
      lastError = e;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("AI recipe generation failed");
}

function computeCoveragePercent(pantry: string[], used: string[]) {
  if (used.length === 0) return 0;
  const pantrySet = new Set(pantry.map(canonicalize).filter(Boolean));
  let matched = 0;
  for (const u of used) {
    const k = canonicalize(u);
    if (!k) continue;
    if (pantrySet.has(k)) matched += 1;
  }
  return Math.round((matched / used.length) * 100);
}

export async function generateRecipesFromPantry(input: {
  pantryItems: string[];
  mealType: MealType;
  who: Who;
  servings: number;
  diet: Diet;
}) {
  const pantry = input.pantryItems
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 200);

  const prompt = `You are a friendly chef for a mobile pantry app.

User context:
- Meal type: ${input.mealType}
- Who's eating: ${input.who}
- Desired servings: ${input.servings}
- Dietary preference: ${normalizeDietLabel(input.diet)}

Pantry items (use ONLY these as ingredients if possible):
${pantry.map((p) => `- ${p}`).join("\n")}

Task:
- Generate 3 recipes.
- Strong preference: missingIngredients must be [] (zero missing items).
- If you truly cannot make 3 recipes with zero missing, you may include at most 2 missing items, but only if pantryCoverage >= 80.
- Avoid brand names in ingredient lists; use generic ingredient terms.
- Prefer dinner-friendly options if meal type is dinner.
- Keep steps short and actionable (mobile friendly).

Return ONLY valid JSON with this exact shape:
{"recipes":[{"title":"...","description":"...","servings":2,"timeMinutes":25,"pantryCoverage":90,"missingIngredients":["..."],"ingredientsUsed":["..."],"steps":["..."]}]}

Rules:
- steps: 5 to 10 steps
- ingredientsUsed: 4 to 14 items
- timeMinutes: integer 5-180
- servings: integer 1-8
  - pantryCoverage: integer 0-100
  - No markdown, no extra keys, no extra text.`;

  const text = await generateTextWithChatProviders({ prompt });

  const jsonText = extractJsonObject(text);
  if (!jsonText) throw new Error("AI provider returned non-JSON output");

  const parsed = JSON.parse(jsonText) as unknown;
  const rawRecipes =
    parsed && typeof parsed === "object" && "recipes" in parsed
      ? (parsed as { recipes?: unknown }).recipes
      : null;

  if (!Array.isArray(rawRecipes)) return [];

  const zeroMissing: AiRecipe[] = [];
  const acceptableMissing: AiRecipe[] = [];

  for (const v of rawRecipes) {
    if (!v || typeof v !== "object") continue;
    const obj = v as Record<string, unknown>;
    const title = cleanString(obj.title);
    const description = cleanString(obj.description);
    if (!title || !description) continue;

    const servings = clampInt(obj.servings, 1, 8, input.servings);
    const timeMinutes = clampInt(obj.timeMinutes, 5, 180, 25);
    const missingIngredients = cleanStringList(obj.missingIngredients, 2);
    const ingredientsUsed = cleanStringList(obj.ingredientsUsed, 14);
    const steps = cleanStringList(obj.steps, 12).slice(0, 10);
    const pantryCoverage = clampInt(
      obj.pantryCoverage,
      0,
      100,
      computeCoveragePercent(pantry, ingredientsUsed)
    );
    if (steps.length < 4) continue;

    const id = makeId(`${title}|${ingredientsUsed.join("|")}`);
    const recipe: AiRecipe = {
      id,
      title,
      description,
      servings,
      timeMinutes,
      pantryCoverage,
      missingIngredients,
      ingredientsUsed,
      steps,
      imageUrl: null,
    };

    if (missingIngredients.length === 0) {
      zeroMissing.push(recipe);
      continue;
    }

    if (missingIngredients.length <= 2 && pantryCoverage >= 80) {
      acceptableMissing.push(recipe);
    }
  }

  const out: AiRecipe[] = [];
  for (const r of zeroMissing) {
    out.push(r);
    if (out.length >= 3) return out;
  }
  for (const r of acceptableMissing) {
    out.push(r);
    if (out.length >= 3) return out;
  }
  return out;
}

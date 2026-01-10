import { openAICompatibleChat } from "@/lib/ai/openai-compatible";
import { getChatProviders } from "@/lib/ai/providers";
import {
  pantryCategories,
  type PantryCategory,
  normalizeCategory,
} from "@/lib/pantry";

function buildPrompt(itemName: string) {
  const options = pantryCategories.join(", ");
  return `Classify this pantry item into exactly one grocery category from this list: ${options}.

Item: ${itemName}

Return only the category name.

Examples:
- "Honey" -> Pantry Staples
- "Bread" -> Bakery
- "Olive oil" -> Oils & Vinegars
- "Soy sauce" -> Condiments & Sauces
- "Salt" -> Spices & Seasonings
- "Pasta" -> Grains & Pasta
- "Canned tomatoes" -> Canned & Jarred
- "Milk" -> Dairy & Eggs
- "Chicken breast" -> Meat & Seafood
- "Bananas" -> Fruit & Veg
- "Frozen peas" -> Frozen`;
}

export async function suggestPantryCategory(itemName: string) {
  const name = itemName.trim();
  if (!name) return "Other" satisfies PantryCategory;

  const system: { role: "system"; content: string } = {
    role: "system",
    content:
      "You are a strict classifier. Output exactly one category name and nothing else.",
  };

  const user: { role: "user"; content: string } = {
    role: "user",
    content: buildPrompt(name),
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
      return normalizeCategory(out);
    } catch {}
  }

  return "Other" satisfies PantryCategory;
}

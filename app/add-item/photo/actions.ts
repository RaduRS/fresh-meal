"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { normalizePantryItemName } from "@/lib/ai/item-name";
import { suggestPantryCategory } from "@/lib/ai/category";
import { insertPantryItem } from "@/lib/pantry";

function parseItems(json: string) {
  const parsed = JSON.parse(json) as unknown;
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((v) => {
      const obj = v as Record<string, unknown>;
      const name = typeof obj.name === "string" ? obj.name : "";
      const quantityRaw = Number(obj.quantity);
      const quantity = Number.isFinite(quantityRaw)
        ? Math.max(1, Math.floor(quantityRaw))
        : 1;

      return { name: name.trim(), quantity };
    })
    .filter((i) => i.name.length > 0)
    .slice(0, 50);
}

export async function addPhotoItemsAction(formData: FormData) {
  const itemsRaw = String(formData.get("items") ?? "");
  if (!itemsRaw) return;

  const items = parseItems(itemsRaw);
  if (items.length === 0) return;

  for (const item of items) {
    const name = await normalizePantryItemName(item.name);
    if (!name) continue;
    const category = await suggestPantryCategory(name);
    await insertPantryItem({ name, category, quantity: item.quantity });
  }

  revalidatePath("/inventory");
  redirect("/inventory");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { suggestPantryCategory } from "@/lib/ai/category";
import { normalizePantryItemName } from "@/lib/ai/item-name";
import { insertPantryItem, softDeletePantryItem } from "@/lib/pantry";

function parseQuantity(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.floor(n));
}

export async function addPantryItemAction(formData: FormData) {
  const rawName = String(formData.get("name") ?? "").trim();
  const quantity = parseQuantity(String(formData.get("quantity") ?? "1"));

  if (!rawName) return;

  const name = await normalizePantryItemName(rawName);
  if (!name) return;

  const category = await suggestPantryCategory(name);

  await insertPantryItem({ name, category, quantity });
  revalidatePath("/inventory");
  redirect("/inventory");
}

export async function deletePantryItemAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await softDeletePantryItem(id);
  revalidatePath("/inventory");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { normalizePantryItemName } from "@/lib/ai/item-name";
import { suggestPantryCategory } from "@/lib/ai/category";
import { insertPantryItem } from "@/lib/pantry";
import { ensurePantryItemImage } from "@/lib/pantry-images";

function parseQuantity(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

export async function addBarcodeItemAction(formData: FormData) {
  const rawName = String(formData.get("name") ?? "").trim();
  const barcode = String(formData.get("barcode") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const quantity = parseQuantity(String(formData.get("quantity") ?? "1"));

  if (!rawName) return;

  const name = await normalizePantryItemName(rawName);
  if (!name) return;

  const category = await suggestPantryCategory(name);

  const id = await insertPantryItem({
    name,
    category,
    quantity,
    barcode: barcode || null,
    imageUrl: imageUrl || null,
  });

  if (id && !imageUrl) {
    await ensurePantryItemImage({ id }).catch(() => null);
  }

  revalidatePath("/inventory");
  redirect("/inventory");
}

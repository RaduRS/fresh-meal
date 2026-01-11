"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { suggestPantryCategory } from "@/lib/ai/category";
import { normalizePantryItemName } from "@/lib/ai/item-name";
import { insertPantryItem, softDeletePantryItem } from "@/lib/pantry";
import { deletePantryItemImage } from "@/lib/pantry-images";
import { updatePantryItem } from "@/lib/pantry";

function parseQuantity(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.round(n * 100) / 100);
}

function parseUnit(value: string) {
  const v = value.trim();
  if (v === "g" || v === "ml" || v === "count") return v;
  return "count";
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  const v = String(value ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseRequiredNumber(value: FormDataEntryValue | null) {
  const n = parseOptionalNumber(value);
  if (typeof n !== "number") {
    throw new Error("Missing macros");
  }
  return n;
}

export async function addPantryItemAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const rawName = String(formData.get("name") ?? "").trim();
  const quantity = parseQuantity(String(formData.get("quantity") ?? "1"));
  const quantityUnit = parseUnit(
    String(formData.get("quantityUnit") ?? "count")
  );
  const caloriesKcal100g = parseRequiredNumber(
    formData.get("caloriesKcal100g")
  );
  const proteinG100g = parseRequiredNumber(formData.get("proteinG100g"));
  const carbsG100g = parseRequiredNumber(formData.get("carbsG100g"));
  const fatG100g = parseRequiredNumber(formData.get("fatG100g"));
  const sugarG100g = parseRequiredNumber(formData.get("sugarG100g"));

  if (!rawName) return;

  const name = await normalizePantryItemName(rawName);
  if (!name) return;

  const category = await suggestPantryCategory(name);

  if (id) {
    await updatePantryItem({
      id,
      name,
      category,
      quantity,
      quantityUnit,
      caloriesKcal100g,
      proteinG100g,
      carbsG100g,
      fatG100g,
      sugarG100g,
    });
  } else {
    const createdId = await insertPantryItem({
      name,
      category,
      quantity,
      quantityUnit,
      caloriesKcal100g,
      proteinG100g,
      carbsG100g,
      fatG100g,
      sugarG100g,
    });
    void createdId;
  }
  revalidatePath("/inventory");
  redirect("/inventory");
}

export async function deletePantryItemAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await softDeletePantryItem(id);
  await deletePantryItemImage({ id }).catch(() => null);
  revalidatePath("/inventory");
}

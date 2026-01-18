import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const pantryCategories = [
  "Fruit & Veg",
  "Dairy & Eggs",
  "Meat & Seafood",
  "Bakery",
  "Frozen",
  "Pantry Staples",
  "Canned & Jarred",
  "Grains & Pasta",
  "Baking",
  "Snacks",
  "Beverages",
  "Condiments & Sauces",
  "Spices & Seasonings",
  "Oils & Vinegars",
  "Baby",
  "Other",
] as const;

export type PantryCategory = (typeof pantryCategories)[number];

export function normalizeCategory(value: string): PantryCategory {
  const normalized = value.trim().replace(/^"+|"+$/g, "");
  const normalizedAlias =
    normalized.toLowerCase() === "produce" ? "Fruit & Veg" : normalized;
  const match = pantryCategories.find((c) => {
    return c.toLowerCase() === normalizedAlias.toLowerCase();
  });
  return match ?? "Other";
}

export type PantryItem = {
  id: string;
  name: string;
  category: PantryCategory;
  quantity: number;
  quantity_unit: "count" | "g" | "ml";
  calories_kcal_100g: number | null;
  protein_g_100g: number | null;
  carbs_g_100g: number | null;
  fat_g_100g: number | null;
  sugar_g_100g: number | null;
  barcode: string | null;
  image_url: string | null;
  added_date: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

function roundCaloriesKcal(value: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function roundMacroG(value: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 10) / 10);
}

export async function listPantryItems() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pantry_items")
    .select(
      "id,name,category,quantity,quantity_unit,calories_kcal_100g,protein_g_100g,carbs_g_100g,fat_g_100g,sugar_g_100g,barcode,image_url,added_date,deleted_at,created_at,updated_at",
    )
    .is("deleted_at", null)
    .order("added_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PantryItem[];
}

export async function getPantryItemById(id: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pantry_items")
    .select(
      "id,name,category,quantity,quantity_unit,calories_kcal_100g,protein_g_100g,carbs_g_100g,fat_g_100g,sugar_g_100g,barcode,image_url,added_date,deleted_at,created_at,updated_at",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as PantryItem | null;
}

export async function insertPantryItem(input: {
  name: string;
  category: PantryCategory;
  quantity: number;
  quantityUnit?: PantryItem["quantity_unit"] | null;
  caloriesKcal100g: number;
  proteinG100g: number;
  carbsG100g: number;
  fatG100g: number;
  sugarG100g: number;
  barcode?: string | null;
  imageUrl?: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const caloriesKcal100g = roundCaloriesKcal(input.caloriesKcal100g);
  const proteinG100g = roundMacroG(input.proteinG100g);
  const carbsG100g = roundMacroG(input.carbsG100g);
  const fatG100g = roundMacroG(input.fatG100g);
  const sugarG100g = roundMacroG(input.sugarG100g);
  const { data, error } = await supabase
    .from("pantry_items")
    .insert({
      name: input.name,
      category: input.category,
      quantity: input.quantity,
      quantity_unit: input.quantityUnit ?? "count",
      calories_kcal_100g: caloriesKcal100g,
      protein_g_100g: proteinG100g,
      carbs_g_100g: carbsG100g,
      fat_g_100g: fatG100g,
      sugar_g_100g: sugarG100g,
      barcode: input.barcode ?? null,
      image_url: input.imageUrl ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return String((data as { id?: unknown } | null)?.id ?? "");
}

export async function updatePantryItem(input: {
  id: string;
  name: string;
  category: PantryCategory;
  quantity: number;
  quantityUnit?: PantryItem["quantity_unit"] | null;
  caloriesKcal100g: number;
  proteinG100g: number;
  carbsG100g: number;
  fatG100g: number;
  sugarG100g: number;
}) {
  const supabase = createSupabaseAdminClient();
  const caloriesKcal100g = roundCaloriesKcal(input.caloriesKcal100g);
  const proteinG100g = roundMacroG(input.proteinG100g);
  const carbsG100g = roundMacroG(input.carbsG100g);
  const fatG100g = roundMacroG(input.fatG100g);
  const sugarG100g = roundMacroG(input.sugarG100g);
  const { error } = await supabase
    .from("pantry_items")
    .update({
      name: input.name,
      category: input.category,
      quantity: input.quantity,
      quantity_unit: input.quantityUnit ?? "count",
      calories_kcal_100g: caloriesKcal100g,
      protein_g_100g: proteinG100g,
      carbs_g_100g: carbsG100g,
      fat_g_100g: fatG100g,
      sugar_g_100g: sugarG100g,
    })
    .eq("id", input.id)
    .is("deleted_at", null);

  if (error) throw error;
}

export async function updatePantryItemNameAndCategory(input: {
  id: string;
  name: string;
  category: PantryCategory;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("pantry_items")
    .update({
      name: input.name,
      category: input.category,
    })
    .eq("id", input.id)
    .is("deleted_at", null);

  if (error) throw error;
}

export async function softDeletePantryItem(id: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("pantry_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

function canonicalize(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function roundQuantity(value: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100) / 100);
}

export async function consumePantryIngredients(input: {
  ingredients: Array<{
    name: string;
    quantity: number;
    quantityUnit: "count" | "g" | "ml";
  }>;
}) {
  const ingredients = (input.ingredients ?? [])
    .map((i) => {
      const name = String(i?.name ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 80);
      const quantityRaw = Number(i?.quantity);
      const quantity = Number.isFinite(quantityRaw) ? quantityRaw : 0;
      const quantityUnit =
        i?.quantityUnit === "count" ||
        i?.quantityUnit === "g" ||
        i?.quantityUnit === "ml"
          ? i.quantityUnit
          : null;
      if (!name || !quantityUnit) return null;
      return { name, quantity, quantityUnit };
    })
    .filter(
      (
        x,
      ): x is {
        name: string;
        quantity: number;
        quantityUnit: "count" | "g" | "ml";
      } => x !== null,
    )
    .slice(0, 24);

  if (ingredients.length === 0) {
    return { ok: true, updated: 0, deleted: 0, skipped: 0 };
  }

  const pantryItems = await listPantryItems();
  const itemsByKey = new Map<string, PantryItem[]>();
  for (const item of pantryItems) {
    const qty = Number(item.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const key = canonicalize(item.name);
    if (!key) continue;
    const existing = itemsByKey.get(key);
    if (existing) existing.push(item);
    else itemsByKey.set(key, [item]);
  }

  const supabase = createSupabaseAdminClient();
  let updated = 0;
  let deleted = 0;
  let skipped = 0;

  for (const ing of ingredients) {
    const key = canonicalize(ing.name);
    const candidatesAll = key ? (itemsByKey.get(key) ?? []) : [];
    const candidates = candidatesAll.filter(
      (x) => x.quantity_unit === ing.quantityUnit,
    );

    let remaining =
      ing.quantityUnit === "count"
        ? Math.round(ing.quantity)
        : roundQuantity(ing.quantity);

    if (candidates.length === 0 || remaining <= 0) {
      skipped += 1;
      continue;
    }

    for (const item of candidates) {
      if (remaining <= 0) break;
      const available =
        item.quantity_unit === "count"
          ? Math.round(Number(item.quantity))
          : roundQuantity(Number(item.quantity));
      if (!Number.isFinite(available) || available <= 0) continue;
      const take = Math.min(available, remaining);
      const nextQty =
        item.quantity_unit === "count"
          ? Math.max(0, available - take)
          : roundQuantity(available - take);
      remaining =
        item.quantity_unit === "count"
          ? Math.max(0, remaining - take)
          : roundQuantity(remaining - take);

      item.quantity = nextQty;

      if (nextQty <= 0) {
        const { error } = await supabase
          .from("pantry_items")
          .update({ quantity: 0, deleted_at: new Date().toISOString() })
          .eq("id", item.id)
          .is("deleted_at", null);
        if (error) throw error;
        deleted += 1;
      } else {
        const { error } = await supabase
          .from("pantry_items")
          .update({ quantity: nextQty })
          .eq("id", item.id)
          .is("deleted_at", null);
        if (error) throw error;
        updated += 1;
      }
    }

    if (remaining > 0) skipped += 1;
  }

  return { ok: true, updated, deleted, skipped };
}

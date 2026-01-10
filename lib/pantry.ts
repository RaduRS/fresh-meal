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
  serving_size: string | null;
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

export async function listPantryItems() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pantry_items")
    .select(
      "id,name,category,quantity,quantity_unit,serving_size,calories_kcal_100g,protein_g_100g,carbs_g_100g,fat_g_100g,sugar_g_100g,barcode,image_url,added_date,deleted_at,created_at,updated_at"
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
      "id,name,category,quantity,quantity_unit,serving_size,calories_kcal_100g,protein_g_100g,carbs_g_100g,fat_g_100g,sugar_g_100g,barcode,image_url,added_date,deleted_at,created_at,updated_at"
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
  servingSize?: string | null;
  caloriesKcal100g?: number | null;
  proteinG100g?: number | null;
  carbsG100g?: number | null;
  fatG100g?: number | null;
  sugarG100g?: number | null;
  barcode?: string | null;
  imageUrl?: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pantry_items")
    .insert({
      name: input.name,
      category: input.category,
      quantity: input.quantity,
      quantity_unit: input.quantityUnit ?? "count",
      serving_size: input.servingSize ?? null,
      calories_kcal_100g: input.caloriesKcal100g ?? null,
      protein_g_100g: input.proteinG100g ?? null,
      carbs_g_100g: input.carbsG100g ?? null,
      fat_g_100g: input.fatG100g ?? null,
      sugar_g_100g: input.sugarG100g ?? null,
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
  servingSize?: string | null;
  caloriesKcal100g?: number | null;
  proteinG100g?: number | null;
  carbsG100g?: number | null;
  fatG100g?: number | null;
  sugarG100g?: number | null;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("pantry_items")
    .update({
      name: input.name,
      category: input.category,
      quantity: input.quantity,
      quantity_unit: input.quantityUnit ?? "count",
      serving_size: input.servingSize ?? null,
      calories_kcal_100g: input.caloriesKcal100g ?? null,
      protein_g_100g: input.proteinG100g ?? null,
      carbs_g_100g: input.carbsG100g ?? null,
      fat_g_100g: input.fatG100g ?? null,
      sugar_g_100g: input.sugarG100g ?? null,
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

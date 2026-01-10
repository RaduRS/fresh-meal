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
      "id,name,category,quantity,barcode,image_url,added_date,deleted_at,created_at,updated_at"
    )
    .is("deleted_at", null)
    .order("added_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PantryItem[];
}

export async function insertPantryItem(input: {
  name: string;
  category: PantryCategory;
  quantity: number;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("pantry_items").insert({
    name: input.name,
    category: input.category,
    quantity: input.quantity,
  });

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

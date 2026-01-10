import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generatePngFromNebius } from "@/lib/ai/nebius";

function makePrompt(name: string, category: string) {
  const base = name.trim();
  const cat = category.trim();
  return `Studio product photo of ${base}. Category: ${cat}. Centered, clean neutral background, realistic, soft lighting, high detail, no packaging text visible.`;
}

function getBucketName() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_IMAGES_BUCKET?.trim() || "pantry-images"
  );
}

function getObjectPath(id: string) {
  return `pantry/${id}.png`;
}

export async function ensurePantryItemImage(input: { id: string }) {
  const supabase = createSupabaseAdminClient();

  const { data: item, error } = await supabase
    .from("pantry_items")
    .select("id,name,category,image_url")
    .eq("id", input.id)
    .single();

  if (error) throw error;
  if (!item) return null;
  if (item.image_url) return item.image_url as string;

  const png = await generatePngFromNebius({
    prompt: makePrompt(String(item.name ?? ""), String(item.category ?? "")),
    width: 512,
    height: 512,
  });

  if (!png) return null;

  const bucket = getBucketName();
  const objectPath = getObjectPath(String(item.id));

  const upload = await supabase.storage.from(bucket).upload(objectPath, png, {
    contentType: "image/png",
    upsert: true,
  });

  if (upload.error) throw upload.error;

  const publicUrl = supabase.storage.from(bucket).getPublicUrl(objectPath)
    .data.publicUrl;
  if (!publicUrl) return null;

  const { error: updateError } = await supabase
    .from("pantry_items")
    .update({ image_url: publicUrl })
    .eq("id", item.id);

  if (updateError) throw updateError;

  return publicUrl;
}

export async function deletePantryItemImage(input: { id: string }) {
  const supabase = createSupabaseAdminClient();
  const bucket = getBucketName();
  const objectPath = getObjectPath(input.id);
  const { error } = await supabase.storage.from(bucket).remove([objectPath]);
  if (error) throw error;
}

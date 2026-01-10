import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generatePngFromNebius } from "@/lib/ai/nebius";

function getBucketName() {
  return process.env.NEXT_PUBLIC_SUPABASE_RECIPE_IMAGES_BUCKET?.trim() || "recipe-images";
}

function getObjectPath(id: string) {
  return `recipes/${id}.png`;
}

function makePrompt(input: { title: string; description: string }) {
  const t = input.title.trim();
  const d = input.description.trim();
  return `Studio food photography of a single plated dish. Dish: ${t}. Description: ${d}. Photorealistic, soft natural lighting, shallow depth of field, clean background, no packaging, no text, no logos.`;
}

export async function ensureRecipeImage(input: {
  id: string;
  title: string;
  description: string;
}) {
  const png = await generatePngFromNebius({
    prompt: makePrompt({ title: input.title, description: input.description }),
    width: 768,
    height: 512,
  });

  if (!png) return null;

  const supabase = createSupabaseAdminClient();
  const bucket = getBucketName();
  const objectPath = getObjectPath(input.id);

  const upload = await supabase.storage.from(bucket).upload(objectPath, png, {
    contentType: "image/png",
    upsert: true,
  });

  if (upload.error) throw upload.error;

  const publicUrl = supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
  return publicUrl || null;
}


import "server-only";

type NebiusGenerateResponse = {
  data?: Array<{
    b64_json?: string;
  }>;
  error?: unknown;
};

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) return null;
  return value.trim();
}

export async function generatePngFromNebius(input: {
  prompt: string;
  width?: number;
  height?: number;
  model?: string;
  negativePrompt?: string;
}) {
  const apiKey = getEnv("NEBIUS_API_KEY");
  if (!apiKey) return null;

  const width = input.width ?? 512;
  const height = input.height ?? 512;
  const model = input.model ?? (getEnv("NEBIUS_MODEL") || "black-forest-labs/flux-schnell");

  const prompt = [
    input.prompt,
    "CRITICAL: ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO WRITING, NO CAPTIONS, NO TYPOGRAPHY anywhere in the image.",
  ]
    .filter(Boolean)
    .join(" ");

  const response = await fetch("https://api.studio.nebius.ai/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      width,
      height,
      num_inference_steps: 4,
      negative_prompt: input.negativePrompt,
      response_extension: "png",
      response_format: "b64_json",
      seed: -1,
    }),
  });

  const payload = (await response.json().catch(() => null)) as NebiusGenerateResponse | null;
  if (!response.ok) return null;

  const b64 = payload?.data?.[0]?.b64_json;
  if (!b64 || !b64.trim()) return null;

  return Buffer.from(b64, "base64");
}


import { NextResponse } from "next/server";

import { detectPantryItemsFromImage } from "@/lib/ai/gemini";

export const runtime = "nodejs";

function parseRetrySeconds(message: string) {
  const m = message.match(/retry in\s+([0-9.]+)s/i);
  if (!m) return null;
  const seconds = Number(m[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(120, Math.ceil(seconds));
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("photo");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No photo selected." },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Unsupported file type." },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const base64 = bytes.toString("base64");
    const out = await detectPantryItemsFromImage({
      base64,
      mimeType: file.type,
    });

    const items = out.items.filter((i) => i.confidence >= 0.7).slice(0, 20);
    if (items.length === 0) {
      return NextResponse.json(
        { error: "No confident items detected. Try another photo." },
        { status: 400 }
      );
    }

    return NextResponse.json({ items });
  } catch (e) {
    const message =
      e instanceof Error && e.message
        ? e.message.slice(0, 800)
        : "Could not analyze photo. Try again.";

    if (message.includes("Gemini error (429)")) {
      const retrySeconds = parseRetrySeconds(message) ?? 25;
      return NextResponse.json(
        {
          error: `Rate limit reached. Try again in ~${retrySeconds}s.`,
          retrySeconds,
        },
        { status: 429, headers: { "Retry-After": String(retrySeconds) } }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

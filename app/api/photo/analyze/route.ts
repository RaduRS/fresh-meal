import { NextResponse } from "next/server";

import { detectPantryItemsFromImage } from "@/lib/ai/pantry-vision";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const t0 = Date.now();
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

    const tReadStart = Date.now();
    const bytes = Buffer.from(await file.arrayBuffer());
    const base64 = bytes.toString("base64");
    const tReadMs = Date.now() - tReadStart;
    const tDetectStart = Date.now();
    const out = await detectPantryItemsFromImage({
      base64,
      mimeType: file.type,
    });
    const tDetectMs = Date.now() - tDetectStart;

    const items = out.items.filter((i) => i.confidence >= 0.3).slice(0, 30);
    if (items.length === 0) {
      return NextResponse.json(
        { error: "No confident items detected. Try another photo." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      items,
      timingMs: {
        readFile: tReadMs,
        detect: tDetectMs,
        total: Date.now() - t0,
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not analyze photo. Try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

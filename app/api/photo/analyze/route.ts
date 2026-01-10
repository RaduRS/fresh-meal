import { NextResponse } from "next/server";

import { detectPantryItemsFromImage } from "@/lib/ai/gemini";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("photo");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No photo selected." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
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
        { status: 400 },
      );
    }

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "Could not analyze photo. Try again." }, { status: 500 });
  }
}


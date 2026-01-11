import { NextResponse } from "next/server";

import { ensurePantryItemImage } from "@/lib/pantry-images";

function readBody(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const id = typeof obj.id === "string" ? obj.id.trim() : "";
  if (!id) return null;
  return { id };
}

export async function POST(req: Request) {
  try {
    const raw = (await req.json().catch(() => null)) as unknown;
    const body = readBody(raw);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const imageUrl = await ensurePantryItemImage({ id: body.id }).catch(() => null);
    return NextResponse.json({ ok: true, imageUrl });
  } catch {
    return NextResponse.json({ error: "Could not ensure image." }, { status: 500 });
  }
}


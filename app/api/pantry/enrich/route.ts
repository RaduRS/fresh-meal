import { NextResponse } from "next/server";
import {
  getPantryItemById,
  updatePantryItemNameAndCategory,
} from "@/lib/pantry";
import { normalizePantryItemName } from "@/lib/ai/item-name";
import { suggestPantryCategory } from "@/lib/ai/category";

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
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const item = await getPantryItemById(body.id);
    if (!item) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    const name = await normalizePantryItemName(item.name);
    if (!name) {
      return NextResponse.json(
        { error: "Could not normalize name." },
        { status: 500 }
      );
    }
    const category = await suggestPantryCategory(name);

    await updatePantryItemNameAndCategory({ id: item.id, name, category });

    return NextResponse.json({ ok: true, name, category });
  } catch {
    return NextResponse.json(
      { error: "Could not enrich item." },
      { status: 500 }
    );
  }
}

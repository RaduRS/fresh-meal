import { NextResponse } from "next/server";

import { normalizePantryItemName } from "@/lib/ai/item-name";
import { suggestPantryCategory } from "@/lib/ai/category";
import { insertPantryItem } from "@/lib/pantry";
import { ensurePantryItemImage } from "@/lib/pantry-images";

type AddItemInput = { name: string; quantity: number };

function readItems(data: unknown): AddItemInput[] | null {
  if (!data || typeof data !== "object") return null;
  if (!("items" in data)) return null;
  const raw = (data as Record<string, unknown>).items;
  if (!Array.isArray(raw)) return null;

  const items: AddItemInput[] = [];
  for (const v of raw) {
    if (!v || typeof v !== "object") continue;
    const obj = v as Record<string, unknown>;
    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    const quantityRaw = Number(obj.quantity);
    const quantity = Number.isFinite(quantityRaw)
      ? Math.max(1, Math.floor(quantityRaw))
      : 1;
    if (!name) continue;
    items.push({ name, quantity });
  }

  return items.slice(0, 50);
}

export async function POST(req: Request) {
  try {
    const data = (await req.json()) as unknown;
    const items = readItems(data);
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items to add." }, { status: 400 });
    }

    let added = 0;
    for (const item of items) {
      const name = await normalizePantryItemName(item.name);
      if (!name) continue;
      const category = await suggestPantryCategory(name);
      const id = await insertPantryItem({
        name,
        category,
        quantity: item.quantity,
      });
      if (id) {
        await ensurePantryItemImage({ id }).catch(() => null);
      }
      added += 1;
    }

    return NextResponse.json({ ok: true, added });
  } catch {
    return NextResponse.json(
      { error: "Could not save items. Try again." },
      { status: 500 }
    );
  }
}

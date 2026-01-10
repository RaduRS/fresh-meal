"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type PantryItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  image_url: string | null;
};

export function InventoryClient(props: {
  items: PantryItem[];
  deleteAction: (formData: FormData) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const categories = useMemo(() => {
    const set = new Set(props.items.map((i) => i.category).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [props.items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return props.items.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (!q) return true;
      return i.name.toLowerCase().includes(q);
    });
  }, [category, props.items, query]);

  return (
    <div className="mt-4">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          placeholder="Search pantry…"
        />
        <Select value={category} onChange={(e) => setCategory(e.currentTarget.value)}>
          <option value="all">All</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-xl border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">No matches.</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border bg-muted">
                  {item.image_url ? (
                    <Image
                      src={item.image_url}
                      alt={item.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : null}
                </div>

                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{item.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{item.category}</span>
                    <span>•</span>
                    <span>Qty {item.quantity}</span>
                  </div>
                </div>
              </div>

              <form action={props.deleteAction}>
                <input type="hidden" name="id" value={item.id} />
                <Button type="submit" variant="secondary">
                  Remove
                </Button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


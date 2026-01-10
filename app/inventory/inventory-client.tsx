"use client";

import { useMemo, useRef, useState, type ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import { Beef, Candy, Droplet, Flame, Wheat } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type PantryItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  quantity_unit: "count" | "g" | "ml";
  serving_size: string | null;
  calories_kcal_100g: number | null;
  protein_g_100g: number | null;
  carbs_g_100g: number | null;
  fat_g_100g: number | null;
  sugar_g_100g: number | null;
  image_url: string | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/g).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[1]?.[0] ?? "" : parts[0]?.[1] ?? "";
  return `${first}${second}`.toUpperCase();
}

function formatQuantity(item: PantryItem) {
  const qty = Number.isFinite(item.quantity) ? item.quantity : 0;
  const unit = item.quantity_unit ?? "count";
  const rounded = Math.round(qty * 100) / 100;
  if (unit === "count") return `${rounded}`;
  return `${rounded}${unit}`;
}

function parseServingSize(
  raw: string | null,
  quantityUnit: PantryItem["quantity_unit"]
) {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  const m = text.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
  if (!m) return { text, value: null, unit: null };

  const value = Number(m[1]);
  if (!Number.isFinite(value)) return { text, value: null, unit: null };

  const unitRaw = (m[2] ?? "").trim().toLowerCase();
  if (!unitRaw) {
    if (quantityUnit === "g" || quantityUnit === "ml") {
      return { text: `${value}${quantityUnit}`, value, unit: quantityUnit };
    }
    return { text, value, unit: null };
  }

  if (
    unitRaw === "g" ||
    unitRaw === "gram" ||
    unitRaw === "grams" ||
    unitRaw === "gr"
  )
    return { text: `${value}g`, value, unit: "g" as const };
  if (unitRaw === "ml")
    return { text: `${value}ml`, value, unit: "ml" as const };
  if (
    unitRaw === "l" ||
    unitRaw === "lt" ||
    unitRaw === "liter" ||
    unitRaw === "litre"
  ) {
    const ml = Math.round(value * 1000 * 100) / 100;
    return { text: `${ml}ml`, value: ml, unit: "ml" as const };
  }

  return { text, value, unit: null };
}

function macroChips(item: PantryItem) {
  const values: {
    key: string;
    Icon: ComponentType<{ className?: string }>;
    text: string;
    iconClassName: string;
  }[] = [];

  if (typeof item.calories_kcal_100g === "number")
    values.push({
      key: "kcal",
      Icon: Flame,
      text: `${Math.round(item.calories_kcal_100g)} kcal`,
      iconClassName: "text-orange-600",
    });
  if (typeof item.protein_g_100g === "number")
    values.push({
      key: "protein",
      Icon: Beef,
      text: `${Math.round(item.protein_g_100g * 10) / 10}g`,
      iconClassName: "text-sky-600",
    });
  if (typeof item.carbs_g_100g === "number")
    values.push({
      key: "carbs",
      Icon: Wheat,
      text: `${Math.round(item.carbs_g_100g * 10) / 10}g`,
      iconClassName: "text-amber-600",
    });
  if (typeof item.fat_g_100g === "number")
    values.push({
      key: "fat",
      Icon: Droplet,
      text: `${Math.round(item.fat_g_100g * 10) / 10}g`,
      iconClassName: "text-yellow-600",
    });
  if (typeof item.sugar_g_100g === "number")
    values.push({
      key: "sugar",
      Icon: Candy,
      text: `${Math.round(item.sugar_g_100g * 10) / 10}g`,
      iconClassName: "text-pink-600",
    });

  return values.length ? values : null;
}

export function InventoryClient(props: {
  items: PantryItem[];
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [drag, setDrag] = useState<{
    id: string;
    startX: number;
    dx: number;
  } | null>(null);

  const categories = useMemo(() => {
    const set = new Set(props.items.map((i) => i.category).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [props.items]);

  const visibleItems = useMemo(() => {
    if (hiddenIds.length === 0) return props.items;
    const hidden = new Set(hiddenIds);
    return props.items.filter((i) => !hidden.has(i.id));
  }, [hiddenIds, props.items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visibleItems.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (!q) return true;
      return i.name.toLowerCase().includes(q);
    });
  }, [category, query, visibleItems]);

  async function finalizeDelete(id: string) {
    const formData = new FormData();
    formData.set("id", id);
    await props.deleteAction(formData);
  }

  function clearTimer() {
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
  }

  function scheduleDelete(item: PantryItem) {
    const existing = pendingDelete;
    if (existing && existing.id !== item.id) {
      clearTimer();
      void finalizeDelete(existing.id);
      setPendingDelete(null);
    }

    setHiddenIds((prev) =>
      prev.includes(item.id) ? prev : [...prev, item.id]
    );
    setPendingDelete({ id: item.id, name: item.name });
    clearTimer();
    deleteTimerRef.current = setTimeout(() => {
      void finalizeDelete(item.id);
      setPendingDelete((prev) => (prev?.id === item.id ? null : prev));
    }, 5000);
  }

  function undoDelete() {
    const current = pendingDelete;
    if (!current) return;
    clearTimer();
    setHiddenIds((prev) => prev.filter((id) => id !== current.id));
    setPendingDelete(null);
  }

  return (
    <div className="mt-4">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          placeholder="Search pantry…"
        />
        <Select
          value={category}
          onChange={(e) => setCategory(e.currentTarget.value)}
        >
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
          {filtered.map((item) => {
            const macroValues = macroChips(item);
            const serving = parseServingSize(
              item.serving_size,
              item.quantity_unit
            );
            const qtyRounded = Number.isFinite(item.quantity)
              ? Math.round(item.quantity * 100) / 100
              : 0;
            const showAmountChip =
              item.quantity_unit === "count" ||
              !(
                qtyRounded === 1 &&
                serving?.unit === item.quantity_unit &&
                typeof serving.value === "number"
              );
            const totalAmount =
              item.quantity_unit === "count" &&
              serving?.unit &&
              typeof serving.value === "number"
                ? Math.round(qtyRounded * serving.value * 100) / 100
                : null;

            return (
              <div
                key={item.id}
                className="relative overflow-hidden rounded-xl bg-red-600"
              >
                <button
                  type="button"
                  className="absolute inset-0 z-0 flex w-full items-center justify-end px-5 text-sm font-medium text-white"
                  onClick={() => scheduleDelete(item)}
                >
                  Remove
                </button>

                <div
                  className="relative z-10 flex touch-pan-y items-start justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm"
                  style={{
                    transform:
                      drag?.id === item.id
                        ? `translateX(${Math.max(-96, Math.min(0, drag.dx))}px)`
                        : undefined,
                    transition:
                      drag?.id === item.id ? undefined : "transform 120ms ease",
                  }}
                  onPointerDown={(e) => {
                    setDrag({ id: item.id, startX: e.clientX, dx: 0 });
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    setDrag((prev) => {
                      if (!prev || prev.id !== item.id) return prev;
                      return { ...prev, dx: e.clientX - prev.startX };
                    });
                  }}
                  onPointerUp={() => {
                    setDrag((prev) => {
                      if (!prev || prev.id !== item.id) return prev;
                      if (prev.dx < -80) scheduleDelete(item);
                      return null;
                    });
                  }}
                  onPointerCancel={() => setDrag(null)}
                >
                  <div className="grid w-full min-w-0 grid-cols-[4rem_minmax(0,1fr)] grid-rows-[auto_auto] gap-x-4 gap-y-2">
                    <div className="relative row-span-2 h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted">
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-gradient-to-br from-muted to-secondary text-xs font-semibold text-muted-foreground">
                          {initials(item.name)}
                        </div>
                      )}
                    </div>

                    <div className="col-start-2 row-start-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 truncate text-sm font-medium leading-6">
                          {item.name}
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <span className="max-w-56 truncate rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                            {item.category}
                          </span>
                          {showAmountChip ? (
                            <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                              {item.quantity_unit === "count"
                                ? `Qty: ${formatQuantity(item)}`
                                : formatQuantity(item)}
                            </span>
                          ) : null}
                          {serving ? (
                            <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                              {item.quantity_unit === "count"
                                ? `× ${serving.text}`
                                : serving.text}
                            </span>
                          ) : null}
                          {typeof totalAmount === "number" &&
                          Number.isFinite(totalAmount) &&
                          totalAmount > 0 &&
                          serving?.unit ? (
                            <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                              Total: {totalAmount}
                              {serving.unit}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {macroValues ? (
                      <div className="col-start-2 row-start-2 w-full">
                        <div className="grid w-full grid-cols-2 gap-1.5 sm:grid-cols-5">
                          {macroValues.map(
                            ({ key, Icon, text, iconClassName }) => (
                              <div
                                key={key}
                                className="flex w-full items-center justify-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground"
                              >
                                <Icon className={`size-4 ${iconClassName}`} />
                                <span className="tabular-nums">{text}</span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Button
        type="button"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] right-4 z-40 h-12 w-12 rounded-full p-0 text-lg"
        onClick={() => setAddOpen(true)}
      >
        +
      </Button>

      {pendingDelete ? (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-50 mx-auto w-full max-w-xl px-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
            <div className="min-w-0 truncate text-sm">
              Removed <span className="font-medium">{pendingDelete.name}</span>
            </div>
            <Button type="button" variant="secondary" onClick={undoDelete}>
              Undo
            </Button>
          </div>
        </div>
      ) : null}

      {addOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setAddOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-xl px-4 pb-[calc(env(safe-area-inset-bottom)+6.5rem)]">
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="mb-3 text-sm font-medium">Add item</div>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  asChild
                  className="w-full"
                  onClick={() => setAddOpen(false)}
                >
                  <Link href="/add-item/barcode">Scan barcode</Link>
                </Button>
                <Button
                  asChild
                  variant="secondary"
                  className="w-full"
                  onClick={() => setAddOpen(false)}
                >
                  <Link href="/add-item/photo">Take photo</Link>
                </Button>
                <Button
                  asChild
                  variant="secondary"
                  className="w-full"
                  onClick={() => setAddOpen(false)}
                >
                  <Link href="/add-item/manual">Manual entry</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

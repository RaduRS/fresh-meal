"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
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
  const actionRevealPx = 192;
  const [lazyImageUrls, setLazyImageUrls] = useState<Record<string, string>>(
    {}
  );
  const lazyImageInFlightRef = useRef(new Set<string>());
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{
    id: string;
    startX: number;
    dx: number;
    startOffset: number;
  } | null>(null);

  const itemsWithImages = useMemo(() => {
    if (Object.keys(lazyImageUrls).length === 0) return props.items;
    return props.items.map((item) => {
      if (item.image_url) return item;
      const url = lazyImageUrls[item.id];
      if (!url) return item;
      return { ...item, image_url: url };
    });
  }, [lazyImageUrls, props.items]);

  useEffect(() => {
    let cancelled = false;
    const queue = itemsWithImages
      .filter((i) => !i.image_url)
      .map((i) => i.id)
      .filter((id) => !lazyImageInFlightRef.current.has(id));
    if (queue.length === 0) return;

    const run = async () => {
      const concurrency = 2;
      let cursor = 0;

      const worker = async () => {
        while (true) {
          const index = cursor;
          cursor += 1;
          if (index >= queue.length) return;
          const id = queue[index];
          lazyImageInFlightRef.current.add(id);
          try {
            const res = await fetch("/api/pantry/ensure-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id }),
            });
            const data = (await res.json().catch(() => null)) as unknown;
            const imageUrl =
              data && typeof data === "object" && "imageUrl" in data
                ? (data as { imageUrl?: unknown }).imageUrl
                : null;
            if (cancelled) return;
            if (typeof imageUrl === "string" && imageUrl) {
              setLazyImageUrls((prev) =>
                prev[id] ? prev : { ...prev, [id]: imageUrl }
              );
            }
          } catch {}
        }
      };

      await Promise.all(
        new Array(Math.min(concurrency, queue.length)).fill(null).map(worker)
      );
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [itemsWithImages]);

  const categories = useMemo(() => {
    const set = new Set(itemsWithImages.map((i) => i.category).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [itemsWithImages]);

  const visibleItems = useMemo(() => {
    if (hiddenIds.length === 0) return itemsWithImages;
    const hidden = new Set(hiddenIds);
    return itemsWithImages.filter((i) => !hidden.has(i.id));
  }, [hiddenIds, itemsWithImages]);

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

    setOpenId(null);
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

  function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
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
            const isOpen = openId === item.id;
            const currentTranslateX =
              drag?.id === item.id
                ? clamp(drag.startOffset + drag.dx, -actionRevealPx, 0)
                : isOpen
                ? -actionRevealPx
                : 0;

            return (
              <div
                key={item.id}
                className="relative overflow-hidden rounded-xl"
              >
                <div className="absolute inset-y-0 right-0 z-0 flex">
                  <Link
                    href={`/add-item/manual?id=${encodeURIComponent(item.id)}`}
                    className="flex h-full w-24 items-center justify-center bg-orange-500 text-sm font-medium text-white"
                    onClick={() => setOpenId(null)}
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    className="h-full w-24 bg-red-600 text-sm font-medium text-white"
                    onClick={() => scheduleDelete(item)}
                  >
                    Remove
                  </button>
                </div>

                <div
                  className="relative z-10 flex touch-pan-y items-start justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm"
                  style={{
                    transform: `translateX(${currentTranslateX}px)`,
                    transition:
                      drag?.id === item.id ? undefined : "transform 120ms ease",
                  }}
                  onPointerDown={(e) => {
                    setOpenId((prev) =>
                      prev && prev !== item.id ? null : prev
                    );
                    setDrag({
                      id: item.id,
                      startX: e.clientX,
                      dx: 0,
                      startOffset: isOpen ? -actionRevealPx : 0,
                    });
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
                      const finalTranslateX = clamp(
                        prev.startOffset + prev.dx,
                        -actionRevealPx,
                        0
                      );
                      setOpenId(
                        finalTranslateX < -actionRevealPx / 2 ? item.id : null
                      );
                      return null;
                    });
                  }}
                  onPointerCancel={() => setDrag(null)}
                >
                  <div className="grid w-full min-w-0 grid-cols-[5rem_minmax(0,1fr)] grid-rows-[auto_auto] gap-x-4 gap-y-2 sm:grid-cols-[4rem_minmax(0,1fr)]">
                    <div className="relative row-span-2 h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted sm:h-16 sm:w-16">
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
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1 truncate text-sm font-medium leading-6">
                          {item.name}
                        </div>
                        <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2">
                          <span className="max-w-56 truncate rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                            {item.category}
                          </span>
                          <span className="whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                            {item.quantity_unit === "count"
                              ? `Qty: ${formatQuantity(item)}`
                              : formatQuantity(item)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {macroValues ? (
                      <div className="col-start-2 row-start-2 w-full">
                        <div className="grid w-full grid-cols-3 gap-1.5 sm:grid-cols-5">
                          {macroValues.map(
                            ({ key, Icon, text, iconClassName }) => (
                              <div
                                key={key}
                                className="flex w-full items-center justify-center gap-0.5 whitespace-nowrap rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:gap-1 sm:px-2 sm:py-1 sm:text-[11px]"
                              >
                                <Icon
                                  className={`size-3 sm:size-4 ${iconClassName}`}
                                />
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
                  <Link href="/add-item/manual">Manual entry</Link>
                </Button>
                <Button
                  asChild
                  variant="secondary"
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
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

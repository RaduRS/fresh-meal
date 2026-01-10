"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

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

function initials(name: string) {
  const parts = name.trim().split(/\s+/g).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[1]?.[0] ?? "" : parts[0]?.[1] ?? "";
  return `${first}${second}`.toUpperCase();
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
          {filtered.map((item) => (
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
                className="relative z-10 flex touch-pan-y items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm"
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
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border bg-muted">
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

                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {item.name}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="max-w-56 truncate rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                            {item.category}
                          </span>
                          <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                            Qty {item.quantity}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
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

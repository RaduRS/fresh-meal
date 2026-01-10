"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type UIItem = {
  id: string;
  name: string;
  quantity: number;
  quantityUnit: "count" | "g" | "ml";
  caloriesKcal100g: number | null;
  proteinG100g: number | null;
  carbsG100g: number | null;
  fatG100g: number | null;
  sugarG100g: number | null;
  confidence: number;
  selected: boolean;
};

type AnalyzeItem = {
  name: string;
  quantity: number;
  quantityUnit?: "count" | "g" | "ml";
  nutritionPer100g?: {
    caloriesKcal?: number | null;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
    sugarG?: number | null;
  };
  confidence: number;
};

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return `${Date.now()}-${Math.random()}`;
}

function readError(data: unknown) {
  if (!data || typeof data !== "object") return null;
  if (!("error" in data)) return null;
  const value = (data as Record<string, unknown>).error;
  return typeof value === "string" ? value : null;
}

function readItems(data: unknown): AnalyzeItem[] | null {
  if (!data || typeof data !== "object") return null;
  if (!("items" in data)) return null;
  const value = (data as Record<string, unknown>).items;
  if (!Array.isArray(value)) return null;

  const items: AnalyzeItem[] = [];
  for (const v of value) {
    if (!v || typeof v !== "object") continue;
    const obj = v as Record<string, unknown>;
    const name = typeof obj.name === "string" ? obj.name : "";
    const quantity = Number(obj.quantity);
    const confidence = Number(obj.confidence);
    const quantityUnitRaw = typeof obj.quantityUnit === "string" ? obj.quantityUnit : "";
    const quantityUnit =
      quantityUnitRaw === "g" || quantityUnitRaw === "ml" || quantityUnitRaw === "count"
        ? (quantityUnitRaw as "count" | "g" | "ml")
        : "count";
    const nutritionRaw =
      obj.nutritionPer100g && typeof obj.nutritionPer100g === "object"
        ? (obj.nutritionPer100g as Record<string, unknown>)
        : null;
    const nutritionPer100g = nutritionRaw
      ? {
          caloriesKcal: typeof nutritionRaw.caloriesKcal === "number" ? nutritionRaw.caloriesKcal : null,
          proteinG: typeof nutritionRaw.proteinG === "number" ? nutritionRaw.proteinG : null,
          carbsG: typeof nutritionRaw.carbsG === "number" ? nutritionRaw.carbsG : null,
          fatG: typeof nutritionRaw.fatG === "number" ? nutritionRaw.fatG : null,
          sugarG: typeof nutritionRaw.sugarG === "number" ? nutritionRaw.sugarG : null,
        }
      : undefined;
    if (!name.trim()) continue;

    items.push({
      name: name.trim(),
      quantity: Number.isFinite(quantity) ? quantity : 1,
      quantityUnit,
      nutritionPer100g,
      confidence: Number.isFinite(confidence) ? confidence : 0.8,
    });
  }

  return items;
}

export function PhotoAddClient() {
  const router = useRouter();
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [items, setItems] = useState<UIItem[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const selectedCount = useMemo(
    () => items.filter((i) => i.selected).length,
    [items]
  );

  const selectedPayload = useMemo(() => {
    return items
      .filter((i) => i.selected)
      .map((i) => ({
        name: i.name,
        quantity: i.quantity,
        quantityUnit: i.quantityUnit,
        nutritionPer100g: {
          caloriesKcal: i.caloriesKcal100g,
          proteinG: i.proteinG100g,
          carbsG: i.carbsG100g,
          fatG: i.fatG100g,
          sugarG: i.sugarG100g,
        },
      }));
  }, [items]);

  return (
    <div className="grid grid-cols-1 gap-4">
      <form
        className="rounded-xl border bg-card p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setAnalyzeError(null);
          setAnalyzing(true);
          setItems([]);

          const form = e.currentTarget;
          const fd = new FormData(form);

          try {
            const res = await fetch("/api/photo/analyze", {
              method: "POST",
              body: fd,
            });
            const data = (await res.json()) as unknown;
            if (!res.ok) {
              setAnalyzeError(
                readError(data) ?? "Could not analyze photo. Try again."
              );
              return;
            }

            const parsed = readItems(data) ?? [];
            setItems(() =>
              parsed.map((i) => ({
                id: makeId(),
                name: i.name,
                quantity: Number.isFinite(i.quantity)
                  ? Math.max(0, Math.round(i.quantity * 100) / 100)
                  : 1,
                quantityUnit: i.quantityUnit ?? "count",
                caloriesKcal100g: i.nutritionPer100g?.caloriesKcal ?? null,
                proteinG100g: i.nutritionPer100g?.proteinG ?? null,
                carbsG100g: i.nutritionPer100g?.carbsG ?? null,
                fatG100g: i.nutritionPer100g?.fatG ?? null,
                sugarG100g: i.nutritionPer100g?.sugarG ?? null,
                confidence: Number.isFinite(i.confidence)
                  ? Math.max(0, Math.min(1, i.confidence))
                  : 0.8,
                selected: true,
              }))
            );
          } catch {
            setAnalyzeError("Could not analyze photo. Try again.");
          } finally {
            setAnalyzing(false);
          }
        }}
      >
        <div className="grid grid-cols-1 gap-3">
          <div className="text-sm font-medium">Take a photo</div>
          <div className="text-sm text-muted-foreground">
            We’ll detect items, then you confirm before saving.
          </div>

          <Input
            name="photo"
            type="file"
            accept="image/*"
            capture="environment"
            required
            onChange={(e) => {
              const file = e.currentTarget.files?.[0] ?? null;
              if (!file) return setPhotoPreview(null);
              setPhotoPreview(URL.createObjectURL(file));
            }}
          />

          {photoPreview ? (
            <div className="relative h-48 w-full overflow-hidden rounded-lg border">
              <Image
                src={photoPreview}
                alt="Preview"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={analyzing}>
            {analyzing ? "Analyzing…" : "Analyze photo"}
          </Button>

          {analyzeError ? (
            <div className="text-sm text-red-600">{analyzeError}</div>
          ) : null}
        </div>
      </form>

      {items.length ? (
        <form
          className="rounded-xl border bg-card p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setAddError(null);
            if (selectedCount === 0) return;

            setAdding(true);
            try {
              const res = await fetch("/api/photo/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: selectedPayload }),
              });
              const data = (await res.json()) as unknown;
              if (!res.ok) {
                setAddError(
                  readError(data) ?? "Could not save items. Try again."
                );
                return;
              }

              router.push("/inventory");
              router.refresh();
            } catch {
              setAddError("Could not save items. Try again.");
            } finally {
              setAdding(false);
            }
          }}
        >
          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">Confirm items</div>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setItems((prev) =>
                    prev.map((i) => ({ ...i, selected: true }))
                  )
                }
              >
                Select all
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border bg-background p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) => {
                          const checked = e.currentTarget.checked;
                          setItems((prev) =>
                            prev.map((x) =>
                              x.id === item.id ? { ...x, selected: checked } : x
                            )
                          );
                        }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </label>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        setItems((prev) => prev.filter((x) => x.id !== item.id))
                      }
                    >
                      Remove
                    </Button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      value={item.name}
                      onChange={(e) => {
                        const v = e.currentTarget.value;
                        setItems((prev) =>
                          prev.map((x) =>
                            x.id === item.id ? { ...x, name: v } : x
                          )
                        );
                      }}
                      placeholder="Item name"
                    />
                    <Input
                      value={item.quantity}
                      onChange={(e) => {
                        const n = Number(e.currentTarget.value);
                        const q = Number.isFinite(n)
                          ? Math.max(0, Math.round(n * 100) / 100)
                          : 1;
                        setItems((prev) =>
                          prev.map((x) =>
                            x.id === item.id ? { ...x, quantity: q } : x
                          )
                        );
                      }}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <select
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                      value={item.quantityUnit}
                      onChange={(e) => {
                        const v = e.currentTarget.value;
                        const unit =
                          v === "g" || v === "ml" || v === "count" ? v : "count";
                        setItems((prev) =>
                          prev.map((x) =>
                            x.id === item.id ? { ...x, quantityUnit: unit } : x
                          )
                        );
                      }}
                    >
                      <option value="count">Count</option>
                      <option value="g">Grams</option>
                      <option value="ml">ml</option>
                    </select>
                    <Input
                      value={item.caloriesKcal100g ?? ""}
                      onChange={(e) => {
                        const n = Number(e.currentTarget.value);
                        setItems((prev) =>
                          prev.map((x) =>
                            x.id === item.id
                              ? {
                                  ...x,
                                  caloriesKcal100g: Number.isFinite(n) ? n : null,
                                }
                              : x
                          )
                        );
                      }}
                      placeholder="kcal/100g"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.1"
                    />
                    <Input
                      value={item.proteinG100g ?? ""}
                      onChange={(e) => {
                        const n = Number(e.currentTarget.value);
                        setItems((prev) =>
                          prev.map((x) =>
                            x.id === item.id
                              ? { ...x, proteinG100g: Number.isFinite(n) ? n : null }
                              : x
                          )
                        );
                      }}
                      placeholder="protein g/100g"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.1"
                    />
                    <Input
                      value={item.carbsG100g ?? ""}
                      onChange={(e) => {
                        const n = Number(e.currentTarget.value);
                        setItems((prev) =>
                          prev.map((x) =>
                            x.id === item.id
                              ? { ...x, carbsG100g: Number.isFinite(n) ? n : null }
                              : x
                          )
                        );
                      }}
                      placeholder="carbs g/100g"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.1"
                    />
                    <Input
                      value={item.fatG100g ?? ""}
                      onChange={(e) => {
                        const n = Number(e.currentTarget.value);
                        setItems((prev) =>
                          prev.map((x) =>
                            x.id === item.id
                              ? { ...x, fatG100g: Number.isFinite(n) ? n : null }
                              : x
                          )
                        );
                      }}
                      placeholder="fat g/100g"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.1"
                    />
                    <Input
                      value={item.sugarG100g ?? ""}
                      onChange={(e) => {
                        const n = Number(e.currentTarget.value);
                        setItems((prev) =>
                          prev.map((x) =>
                            x.id === item.id
                              ? { ...x, sugarG100g: Number.isFinite(n) ? n : null }
                              : x
                          )
                        );
                      }}
                      placeholder="sugar g/100g"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.1"
                    />
                  </div>
                </div>
              ))}
            </div>

            {addError ? (
              <div className="text-sm text-red-600">{addError}</div>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={selectedCount === 0 || adding}
            >
              {adding
                ? "Adding…"
                : `Add ${
                    selectedCount === 1 ? "item" : "items"
                  } (${selectedCount})`}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

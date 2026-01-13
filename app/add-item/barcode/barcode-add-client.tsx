"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Beef, Candy, Droplet, Flame, Wheat } from "lucide-react";

import { addBarcodeItemAction } from "./actions";
import { BarcodeScanner } from "./barcode-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MacroIconInput } from "@/components/ui/macro-icon-input";
import { Select } from "@/components/ui/select";

type LookupResult = {
  barcode: string;
  name: string;
  imageUrl: string | null;
  brand: string | null;
  quantity: number;
  quantityUnit: "count" | "g" | "ml";
  nutritionPer100g: {
    caloriesKcal: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    sugarG: number | null;
  };
};

function readError(data: unknown) {
  if (!data || typeof data !== "object") return null;
  if (!("error" in data)) return null;
  const value = (data as Record<string, unknown>).error;
  return typeof value === "string" ? value : null;
}

function readLookup(data: unknown): LookupResult | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const barcode = typeof obj.barcode === "string" ? obj.barcode : "";
  const name = typeof obj.name === "string" ? obj.name : "";
  const imageUrl = typeof obj.imageUrl === "string" ? obj.imageUrl : null;
  const brand = typeof obj.brand === "string" ? obj.brand : null;
  const quantityRaw = Number(obj.quantity);
  const quantity = Number.isFinite(quantityRaw) ? quantityRaw : 1;
  const quantityUnitRaw = typeof obj.quantityUnit === "string" ? obj.quantityUnit : "";
  const quantityUnit =
    quantityUnitRaw === "g" || quantityUnitRaw === "ml" || quantityUnitRaw === "count"
      ? (quantityUnitRaw as "count" | "g" | "ml")
      : "count";
  const nutritionRaw =
    obj.nutritionPer100g && typeof obj.nutritionPer100g === "object"
      ? (obj.nutritionPer100g as Record<string, unknown>)
      : null;
  const nutritionPer100g = {
    caloriesKcal:
      nutritionRaw && typeof nutritionRaw.caloriesKcal === "number"
        ? nutritionRaw.caloriesKcal
        : null,
    proteinG:
      nutritionRaw && typeof nutritionRaw.proteinG === "number"
        ? nutritionRaw.proteinG
        : null,
    carbsG:
      nutritionRaw && typeof nutritionRaw.carbsG === "number"
        ? nutritionRaw.carbsG
        : null,
    fatG:
      nutritionRaw && typeof nutritionRaw.fatG === "number"
        ? nutritionRaw.fatG
        : null,
    sugarG:
      nutritionRaw && typeof nutritionRaw.sugarG === "number"
        ? nutritionRaw.sugarG
        : null,
  };
  if (!barcode.trim() || !name.trim()) return null;
  return { barcode, name, imageUrl, brand, quantity, quantityUnit, nutritionPer100g };
}

function BarcodeAddSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Adding…" : "Add item"}
    </Button>
  );
}

export function BarcodeAddClient() {
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);

  async function lookup(value: string) {
    setLookupError(null);
    setResult(null);

    const cleaned = value.trim().replace(/\s+/g, "");
    if (!cleaned) return;

    setBarcode(cleaned);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/barcode/lookup?barcode=${encodeURIComponent(cleaned)}`,
        { method: "GET" }
      );
      const data = (await res.json()) as unknown;
      if (!res.ok) {
        setLookupError(readError(data) ?? "Lookup failed.");
        return;
      }

      const parsed = readLookup(data);
      if (!parsed) {
        setLookupError("Lookup failed.");
        return;
      }

      setResult(parsed);
    } catch {
      setLookupError("Lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  const displayName = useMemo(() => {
    if (!result) return "";
    const brand = result.brand?.trim();
    const name = result.name.trim();
    if (!brand) return name;
    if (name.toLowerCase().includes(brand.toLowerCase())) return name;
    return `${brand} ${name}`;
  }, [result]);

  return (
    <div className="grid grid-cols-1 gap-4">
      <BarcodeScanner
        onDetected={(code) => {
          void lookup(code);
        }}
      />

      <form
        className="rounded-xl border bg-card p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await lookup(barcode);
        }}
      >
        <div className="grid grid-cols-1 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="barcode">Barcode</Label>
            <Input
              id="barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.currentTarget.value)}
              placeholder="e.g., 5000159407236"
              inputMode="numeric"
              autoComplete="off"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Looking up…" : "Lookup product"}
          </Button>

          {lookupError ? (
            <div className="text-sm text-red-600">{lookupError}</div>
          ) : null}
        </div>
      </form>

      {result ? (
        <form
          action={addBarcodeItemAction}
          className="rounded-xl border bg-card p-4"
        >
          <input type="hidden" name="barcode" value={result.barcode} />
          <input type="hidden" name="imageUrl" value={result.imageUrl ?? ""} />

          <div className="grid grid-cols-1 gap-4">
            <div className="text-sm font-medium">Confirm product</div>

            {result.imageUrl ? (
              <div className="relative h-48 w-full overflow-hidden rounded-lg border">
                <Image
                  src={result.imageUrl}
                  alt={displayName}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={displayName}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="quantity">Amount</Label>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  defaultValue={result.quantity}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quantityUnit">Unit</Label>
                <Select
                  id="quantityUnit"
                  name="quantityUnit"
                  defaultValue={result.quantityUnit}
                >
                  <option value="count">Count</option>
                  <option value="g">Grams (g)</option>
                  <option value="ml">Milliliters (mL)</option>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="text-xs text-muted-foreground">
                Macros per 100g
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Label htmlFor="caloriesKcal100g" className="sr-only">
                  Calories (kcal per 100g)
                </Label>
                <MacroIconInput
                  id="caloriesKcal100g"
                  name="caloriesKcal100g"
                  required
                  defaultValue={result.nutritionPer100g.caloriesKcal ?? ""}
                  aria-label="Calories (kcal per 100g)"
                  icon={<Flame className="size-4 text-orange-600" />}
                />

                <Label htmlFor="proteinG100g" className="sr-only">
                  Protein (g per 100g)
                </Label>
                <MacroIconInput
                  id="proteinG100g"
                  name="proteinG100g"
                  required
                  defaultValue={result.nutritionPer100g.proteinG ?? ""}
                  aria-label="Protein (g per 100g)"
                  icon={<Beef className="size-4 text-sky-600" />}
                />

                <Label htmlFor="carbsG100g" className="sr-only">
                  Carbs (g per 100g)
                </Label>
                <MacroIconInput
                  id="carbsG100g"
                  name="carbsG100g"
                  required
                  defaultValue={result.nutritionPer100g.carbsG ?? ""}
                  aria-label="Carbs (g per 100g)"
                  icon={<Wheat className="size-4 text-amber-600" />}
                />

                <Label htmlFor="fatG100g" className="sr-only">
                  Fat (g per 100g)
                </Label>
                <MacroIconInput
                  id="fatG100g"
                  name="fatG100g"
                  required
                  defaultValue={result.nutritionPer100g.fatG ?? ""}
                  aria-label="Fat (g per 100g)"
                  icon={<Droplet className="size-4 text-yellow-600" />}
                />

                <Label htmlFor="sugarG100g" className="sr-only">
                  Sugar (g per 100g)
                </Label>
                <MacroIconInput
                  id="sugarG100g"
                  name="sugarG100g"
                  required
                  defaultValue={result.nutritionPer100g.sugarG ?? ""}
                  aria-label="Sugar (g per 100g)"
                  icon={<Candy className="size-4 text-pink-600" />}
                />
              </div>
            </div>

            <BarcodeAddSubmitButton />
          </div>
        </form>
      ) : null}
    </div>
  );
}

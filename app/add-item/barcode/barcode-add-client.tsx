"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { addBarcodeItemAction } from "./actions";
import { BarcodeScanner } from "./barcode-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type LookupResult = {
  barcode: string;
  name: string;
  imageUrl: string | null;
  brand: string | null;
  servingSize: string | null;
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
  const servingSize =
    typeof obj.servingSize === "string" ? obj.servingSize : null;
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
  return { barcode, name, imageUrl, brand, servingSize, nutritionPer100g };
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
          <input
            type="hidden"
            name="caloriesKcal100g"
            value={result.nutritionPer100g.caloriesKcal ?? ""}
          />
          <input
            type="hidden"
            name="proteinG100g"
            value={result.nutritionPer100g.proteinG ?? ""}
          />
          <input
            type="hidden"
            name="carbsG100g"
            value={result.nutritionPer100g.carbsG ?? ""}
          />
          <input
            type="hidden"
            name="fatG100g"
            value={result.nutritionPer100g.fatG ?? ""}
          />
          <input
            type="hidden"
            name="sugarG100g"
            value={result.nutritionPer100g.sugarG ?? ""}
          />

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

            <div className="grid gap-2">
              <Label htmlFor="servingSize">Pack size (optional)</Label>
              <Input
                id="servingSize"
                name="servingSize"
                defaultValue={result.servingSize ?? ""}
                placeholder="e.g., 200g or 850ml"
                autoComplete="off"
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
                  defaultValue={1}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quantityUnit">Unit</Label>
                <Select
                  id="quantityUnit"
                  name="quantityUnit"
                  defaultValue="count"
                >
                  <option value="count">Count</option>
                  <option value="g">Grams</option>
                  <option value="ml">ml</option>
                </Select>
              </div>
            </div>

            <BarcodeAddSubmitButton />
          </div>
        </form>
      ) : null}
    </div>
  );
}

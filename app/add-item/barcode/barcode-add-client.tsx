"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { addBarcodeItemAction } from "./actions";
import { BarcodeScanner } from "./barcode-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LookupResult = {
  barcode: string;
  name: string;
  imageUrl: string | null;
  brand: string | null;
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
  if (!barcode.trim() || !name.trim()) return null;
  return { barcode, name, imageUrl, brand };
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

            <div className="grid gap-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                inputMode="numeric"
                min={1}
                defaultValue={1}
              />
            </div>

            <BarcodeAddSubmitButton />
          </div>
        </form>
      ) : null}
    </div>
  );
}

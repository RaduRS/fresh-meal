"use client";

import { useMemo, useState } from "react";

import { ManualAddSubmitButton } from "@/app/add-item/manual/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MacroIconInput } from "@/components/ui/macro-icon-input";
import { Select } from "@/components/ui/select";
import { Beef, Candy, Droplet, Flame, Wheat } from "lucide-react";

type QuantityUnit = "count" | "g" | "ml";

export function ManualAddItemFormClient(props: {
  mode: "add" | "edit";
  item:
    | {
        id: string;
        name: string;
        quantity: number;
        quantity_unit: QuantityUnit;
        calories_kcal_100g: number | null;
        protein_g_100g: number | null;
        carbs_g_100g: number | null;
        fat_g_100g: number | null;
        sugar_g_100g: number | null;
      }
    | null;
  action: (formData: FormData) => void;
}) {
  const item = props.item;

  const [name, setName] = useState(item?.name ?? "");
  const [quantity, setQuantity] = useState(
    typeof item?.quantity === "number" ? String(item.quantity) : "1"
  );
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>(
    item?.quantity_unit ?? "count"
  );
  const [caloriesKcal100g, setCaloriesKcal100g] = useState(
    item?.calories_kcal_100g === null || typeof item?.calories_kcal_100g === "undefined"
      ? ""
      : String(item.calories_kcal_100g)
  );
  const [proteinG100g, setProteinG100g] = useState(
    item?.protein_g_100g === null || typeof item?.protein_g_100g === "undefined"
      ? ""
      : String(item.protein_g_100g)
  );
  const [carbsG100g, setCarbsG100g] = useState(
    item?.carbs_g_100g === null || typeof item?.carbs_g_100g === "undefined"
      ? ""
      : String(item.carbs_g_100g)
  );
  const [fatG100g, setFatG100g] = useState(
    item?.fat_g_100g === null || typeof item?.fat_g_100g === "undefined"
      ? ""
      : String(item.fat_g_100g)
  );
  const [sugarG100g, setSugarG100g] = useState(
    item?.sugar_g_100g === null || typeof item?.sugar_g_100g === "undefined"
      ? ""
      : String(item.sugar_g_100g)
  );

  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  const canEstimate = useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const q = Number(quantity);
    if (!Number.isFinite(q) || q <= 0) return false;
    return quantityUnit === "count" || quantityUnit === "g" || quantityUnit === "ml";
  }, [name, quantity, quantityUnit]);

  return (
    <form action={props.action} className="rounded-xl border bg-card p-4">
      <div className="grid grid-cols-1 gap-4">
        {item ? <input type="hidden" name="id" value={item.id} /> : null}

        <div className="grid gap-2">
          <Label htmlFor="name">Item name</Label>
          <Input
            id="name"
            name="name"
            placeholder="e.g., Honey"
            autoComplete="off"
            required
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
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
              value={quantity}
              onChange={(e) => setQuantity(e.currentTarget.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quantityUnit">Unit</Label>
            <Select
              id="quantityUnit"
              name="quantityUnit"
              value={quantityUnit}
              onChange={(e) => setQuantityUnit(e.currentTarget.value as QuantityUnit)}
            >
              <option value="count">Count</option>
              <option value="g">Grams (g)</option>
              <option value="ml">Milliliters (mL)</option>
            </Select>
          </div>
        </div>

        <div className="flex items-center text-xs text-muted-foreground">
          <div>Macros per 100g</div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto"
            disabled={!canEstimate || estimating}
            onClick={async () => {
              if (!canEstimate) return;
              setEstimateError(null);
              setEstimating(true);
              try {
                const res = await fetch("/api/nutrition/estimate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: name.trim(), brand: null }),
                });
                const data = (await res.json()) as unknown;
                if (!res.ok) {
                  const msg =
                    data && typeof data === "object" && "error" in data
                      ? String((data as { error?: unknown }).error ?? "Estimate failed.")
                      : "Estimate failed.";
                  setEstimateError(msg);
                  return;
                }
                const nutrition =
                  data && typeof data === "object" && "nutritionPer100g" in data
                    ? (data as { nutritionPer100g?: unknown }).nutritionPer100g
                    : null;
                if (!nutrition || typeof nutrition !== "object") {
                  setEstimateError("Estimate failed.");
                  return;
                }
                const obj = nutrition as Record<string, unknown>;
                const caloriesKcal = Number(obj.caloriesKcal);
                const proteinG = Number(obj.proteinG);
                const carbsG = Number(obj.carbsG);
                const fatG = Number(obj.fatG);
                const sugarG = Number(obj.sugarG);
                if (
                  !Number.isFinite(caloriesKcal) ||
                  !Number.isFinite(proteinG) ||
                  !Number.isFinite(carbsG) ||
                  !Number.isFinite(fatG) ||
                  !Number.isFinite(sugarG)
                ) {
                  setEstimateError("Estimate failed.");
                  return;
                }
                setCaloriesKcal100g(String(Math.round(caloriesKcal)));
                setProteinG100g(String(proteinG));
                setCarbsG100g(String(carbsG));
                setFatG100g(String(fatG));
                setSugarG100g(String(sugarG));
              } catch {
                setEstimateError("Estimate failed.");
              } finally {
                setEstimating(false);
              }
            }}
          >
            {estimating ? "Estimating…" : "Estimate"}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Label htmlFor="caloriesKcal100g" className="sr-only">
            Calories (kcal per 100g)
          </Label>
          <MacroIconInput
            id="caloriesKcal100g"
            name="caloriesKcal100g"
            required
            value={caloriesKcal100g}
            onChange={(e) => setCaloriesKcal100g(e.currentTarget.value)}
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
            value={proteinG100g}
            onChange={(e) => setProteinG100g(e.currentTarget.value)}
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
            value={carbsG100g}
            onChange={(e) => setCarbsG100g(e.currentTarget.value)}
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
            value={fatG100g}
            onChange={(e) => setFatG100g(e.currentTarget.value)}
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
            value={sugarG100g}
            onChange={(e) => setSugarG100g(e.currentTarget.value)}
            aria-label="Sugar (g per 100g)"
            icon={<Candy className="size-4 text-pink-600" />}
          />
        </div>

        {estimateError ? (
          <div className="text-xs text-red-600">{estimateError}</div>
        ) : null}

        <ManualAddSubmitButton mode={props.mode} />
      </div>
    </form>
  );
}


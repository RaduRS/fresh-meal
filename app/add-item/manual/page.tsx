import { addPantryItemAction } from "@/app/inventory/actions";
import { ManualAddSubmitButton } from "@/app/add-item/manual/submit-button";
import { AddItemBottomBar } from "@/components/layout/add-item-bottom-bar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export default function ManualAddItemPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-32 pt-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Add manually</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Category will be chosen automatically.
        </p>
      </div>

      <form
        action={addPantryItemAction}
        className="rounded-xl border bg-card p-4"
      >
        <div className="grid grid-cols-1 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Item name</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g., Honey"
              autoComplete="off"
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

          <div className="grid gap-2">
            <Label htmlFor="servingSize">Pack size (optional)</Label>
            <Input
              id="servingSize"
              name="servingSize"
              placeholder="e.g., 200g or 850ml"
              autoComplete="off"
            />
          </div>

          <div className="text-xs text-muted-foreground">
            Macros per 100g (optional)
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="caloriesKcal100g">Calories</Label>
              <Input
                id="caloriesKcal100g"
                name="caloriesKcal100g"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="proteinG100g">Protein (g)</Label>
              <Input
                id="proteinG100g"
                name="proteinG100g"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="carbsG100g">Carbs (g)</Label>
              <Input
                id="carbsG100g"
                name="carbsG100g"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fatG100g">Fat (g)</Label>
              <Input
                id="fatG100g"
                name="fatG100g"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sugarG100g">Sugar (g)</Label>
              <Input
                id="sugarG100g"
                name="sugarG100g"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
              />
            </div>
          </div>

          <ManualAddSubmitButton />
        </div>
      </form>
      <AddItemBottomBar active="manual" />
    </div>
  );
}

import Link from "next/link";

import { addPantryItemAction } from "@/app/inventory/actions";
import { ManualAddSubmitButton } from "@/app/add-item/manual/submit-button";
import { AddItemBottomBar } from "@/components/layout/add-item-bottom-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

          <div className="grid gap-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={1}
            />
          </div>

          <ManualAddSubmitButton />

          <Button asChild variant="ghost" className="w-full">
            <Link href="/inventory">Back to inventory</Link>
          </Button>
        </div>
      </form>
      <AddItemBottomBar active="manual" />
    </div>
  );
}

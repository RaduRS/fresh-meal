import Image from "next/image";

import { deletePantryItemAction } from "./actions";
import { listPantryItems } from "@/lib/pantry";
import { AddItemBottomBar } from "@/components/layout/add-item-bottom-bar";
import { Button } from "@/components/ui/button";

export default async function InventoryPage() {
  const items = await listPantryItems();

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-32 pt-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add what you have. Find recipes later.
        </p>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground">
          Pantry ({items.length})
        </h2>

        {items.length === 0 ? (
          <div className="mt-4 rounded-xl border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No items yet. Add your first item above.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border bg-muted">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {item.name}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{item.category}</span>
                      <span>•</span>
                      <span>Qty {item.quantity}</span>
                    </div>
                  </div>
                </div>

                <form action={deletePantryItemAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <Button type="submit" variant="secondary">
                    Remove
                  </Button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
      <AddItemBottomBar />
    </div>
  );
}

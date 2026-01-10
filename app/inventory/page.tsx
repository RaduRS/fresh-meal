import { deletePantryItemAction } from "./actions";
import { listPantryItems } from "@/lib/pantry";
import { AddItemBottomBar } from "@/components/layout/add-item-bottom-bar";
import { InventoryClient } from "./inventory-client";

export const dynamic = "force-dynamic";

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
          <InventoryClient
            items={items}
            deleteAction={deletePantryItemAction}
          />
        )}
      </div>
      <AddItemBottomBar active="home" />
    </div>
  );
}

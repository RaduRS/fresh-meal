import { addPantryItemAction } from "@/app/inventory/actions";
import { AddItemBottomBar } from "@/components/layout/add-item-bottom-bar";
import { getPantryItemById } from "@/lib/pantry";
import { ManualAddItemFormClient } from "@/app/add-item/manual/manual-form-client";

export const dynamic = "force-dynamic";

export default async function ManualAddItemPage(props: {
  searchParams?: Promise<{ id?: string }>;
}) {
  const searchParams = await Promise.resolve(props.searchParams);
  const id = String(searchParams?.id ?? "").trim();
  const item = id ? await getPantryItemById(id) : null;
  const mode = item ? ("edit" as const) : ("add" as const);

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-32 pt-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">
          {mode === "edit" ? "Edit item" : "Add manually"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Category will be chosen automatically.
        </p>
      </div>

      <ManualAddItemFormClient
        mode={mode}
        item={item}
        action={addPantryItemAction}
      />
      <AddItemBottomBar active="manual" />
    </div>
  );
}

import { BarcodeAddClient } from "./barcode-add-client";
import { AddItemBottomBar } from "@/components/layout/add-item-bottom-bar";

export default function BarcodeAddPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-32 pt-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Add by barcode</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter a barcode to fetch the product.
        </p>
      </div>

      <BarcodeAddClient />

      <AddItemBottomBar active="barcode" />
    </div>
  );
}

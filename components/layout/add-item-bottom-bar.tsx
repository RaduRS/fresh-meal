import Link from "next/link";

import { Button } from "@/components/ui/button";

export function AddItemBottomBar(props: {
  active?: "manual" | "barcode" | "photo";
}) {
  const active = props.active ?? null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/90 backdrop-blur">
      <div className="mx-auto w-full max-w-xl px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
        <div className="grid grid-cols-3 gap-2">
          <Button
            asChild
            variant={active === "manual" ? "default" : "secondary"}
          >
            <Link href="/add-item/manual">Manual</Link>
          </Button>

          <Button
            variant={active === "barcode" ? "default" : "secondary"}
            disabled
          >
            Barcode
          </Button>

          <Button
            asChild
            variant={active === "photo" ? "default" : "secondary"}
          >
            <Link href="/add-item/photo">Photo</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

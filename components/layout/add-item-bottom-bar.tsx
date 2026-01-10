import Link from "next/link";
import { Barcode, Camera, Home, PencilLine, Soup } from "lucide-react";

import { Button } from "@/components/ui/button";

export function AddItemBottomBar(props: {
  active?: "home" | "manual" | "barcode" | "photo" | "recipes";
}) {
  const active = props.active ?? null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/90 backdrop-blur">
      <div className="mx-auto w-full max-w-xl px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
        <div className="grid grid-cols-5 gap-2">
          <Button
            asChild
            variant={active === "home" ? "default" : "secondary"}
            className="h-auto flex-col gap-1 py-2"
          >
            <Link href="/inventory">
              <Home className="size-5" />
              <span className="text-[11px] leading-none">Home</span>
            </Link>
          </Button>

          <Button
            asChild
            variant={active === "manual" ? "default" : "secondary"}
            className="h-auto flex-col gap-1 py-2"
          >
            <Link href="/add-item/manual">
              <PencilLine className="size-5" />
              <span className="text-[11px] leading-none">Manual</span>
            </Link>
          </Button>

          <Button
            asChild
            variant={active === "barcode" ? "default" : "secondary"}
            className="h-auto flex-col gap-1 py-2"
          >
            <Link href="/add-item/barcode">
              <Barcode className="size-5" />
              <span className="text-[11px] leading-none">Barcode</span>
            </Link>
          </Button>

          <Button
            asChild
            variant={active === "photo" ? "default" : "secondary"}
            className="h-auto flex-col gap-1 py-2"
          >
            <Link href="/add-item/photo">
              <Camera className="size-5" />
              <span className="text-[11px] leading-none">Photo</span>
            </Link>
          </Button>

          <Button
            asChild
            variant={active === "recipes" ? "default" : "secondary"}
            className="h-auto flex-col gap-1 py-2"
          >
            <Link href="/recipes">
              <Soup className="size-5" />
              <span className="text-[11px] leading-none">Recipes</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

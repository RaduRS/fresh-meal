import * as React from "react";

import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type MacroIconInputProps = Omit<InputProps, "type"> & {
  icon: React.ReactNode;
};

export function MacroIconInput({
  icon,
  className,
  ...props
}: MacroIconInputProps) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
        {icon}
      </div>
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        step="0.1"
        className={cn("pl-9", className)}
        {...props}
      />
    </div>
  );
}

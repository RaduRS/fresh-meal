import { Beef, Candy, Droplet, Flame, Wheat } from "lucide-react";

import { cn } from "@/lib/utils";

export type MacroSummaryMacros = {
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  sugarG?: number | null;
};

function formatNumber(v: number | null | undefined) {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.round(v);
}

export function MacroSummary(props: {
  macros: MacroSummaryMacros | null | undefined;
  className?: string;
  showSugar?: boolean;
}) {
  const m = props.macros;
  if (!m) return null;

  const calories = formatNumber(m.caloriesKcal);
  const protein = formatNumber(m.proteinG);
  const carbs = formatNumber(m.carbsG);
  const fat = formatNumber(m.fatG);
  const sugar = props.showSugar ? formatNumber(m.sugarG) : null;

  if (
    calories === null &&
    protein === null &&
    carbs === null &&
    fat === null &&
    sugar === null
  ) {
    return null;
  }

  return (
    <span className={cn("inline-flex items-center gap-2", props.className)}>
      {calories !== null ? (
        <span className="inline-flex items-center gap-1">
          <Flame className="size-3.5 text-orange-600" />
          <span>{calories}kcal</span>
        </span>
      ) : null}
      {protein !== null ? (
        <span className="inline-flex items-center gap-1">
          <Beef className="size-3.5 text-sky-600" />
          <span>{protein}g</span>
        </span>
      ) : null}
      {carbs !== null ? (
        <span className="inline-flex items-center gap-1">
          <Wheat className="size-3.5 text-amber-600" />
          <span>{carbs}g</span>
        </span>
      ) : null}
      {fat !== null ? (
        <span className="inline-flex items-center gap-1">
          <Droplet className="size-3.5 text-yellow-600" />
          <span>{fat}g</span>
        </span>
      ) : null}
      {sugar !== null ? (
        <span className="inline-flex items-center gap-1">
          <Candy className="size-3.5 text-pink-600" />
          <span>{sugar}g</span>
        </span>
      ) : null}
    </span>
  );
}

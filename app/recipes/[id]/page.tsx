import { AddItemBottomBar } from "@/components/layout/add-item-bottom-bar";
import { RecipeDetailClient } from "./recipe-detail-client";

export default async function RecipeDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-32 pt-6">
      <RecipeDetailClient id={id} />
      <AddItemBottomBar active="recipes" />
    </div>
  );
}

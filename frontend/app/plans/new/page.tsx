import { parseNewPlanFrom } from "@/lib/view-state/urls";
import { NewPlanPage } from "@/modules/new-plan/new-plan-page";

// `?from=<planId>` opens New Plan reusing that saved plan's import (FR-2). Read on the server and
// passed down, so the page needs no `useSearchParams` (and no Suspense boundary); the key gives a
// fresh form when only the query changes.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const from = parseNewPlanFrom(await searchParams);
  return <NewPlanPage key={from ?? ""} from={from} />;
}

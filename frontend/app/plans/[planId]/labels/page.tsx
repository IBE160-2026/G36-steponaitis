import { LabelsPage } from "@/modules/labels/labels-page";

// Awaiting `searchParams` keeps the route dynamic, so the page's `useSearchParams` (the `?aisle=`)
// renders on the server without a Suspense boundary.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { planId } = await params;
  await searchParams;
  return <LabelsPage planId={planId} />;
}

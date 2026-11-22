import { RecommendationsPage } from "@/modules/recommendations/recommendations-page";

// Awaiting `searchParams` keeps the route dynamic, so the page's `useSearchParams` (the `?tab=`)
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
  return <RecommendationsPage planId={planId} />;
}

import { OverviewPage } from "@/modules/overview/overview-page";

export default async function Page({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  return <OverviewPage planId={planId} />;
}

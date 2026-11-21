import { PickGroupsPage } from "@/modules/pick-groups/pick-groups-page";

export default async function Page({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  return <PickGroupsPage planId={planId} />;
}

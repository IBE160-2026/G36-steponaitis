import { parseLocationParams } from "@/lib/view-state/urls";
import { PickGroupsPage } from "@/modules/pick-groups/pick-groups-page";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { planId } = await params;
  return <PickGroupsPage planId={planId} params={parseLocationParams(await searchParams)} />;
}

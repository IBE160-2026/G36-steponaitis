import { parseLocationParams } from "@/lib/view-state/urls";
import { LocationsPage } from "@/modules/locations/locations-page";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { planId } = await params;
  return <LocationsPage planId={planId} params={parseLocationParams(await searchParams)} />;
}

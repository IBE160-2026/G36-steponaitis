import { parseLocationParams } from "@/lib/view-state/urls";
import { PartsPage } from "@/modules/parts/parts-page";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { planId } = await params;
  return <PartsPage planId={planId} params={parseLocationParams(await searchParams)} />;
}

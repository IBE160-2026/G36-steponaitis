import { PartsPage } from "@/modules/parts/parts-page";

export default async function Page({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  return <PartsPage planId={planId} />;
}

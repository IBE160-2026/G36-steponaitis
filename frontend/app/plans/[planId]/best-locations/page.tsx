import { BestLocationsPage } from "@/modules/best-locations/best-locations-page";

export default async function Page({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  return <BestLocationsPage planId={planId} />;
}

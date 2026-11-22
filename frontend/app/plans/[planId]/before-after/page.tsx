import { BeforeAfterPage } from "@/modules/before-after/before-after-page";

export default async function Page({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  return <BeforeAfterPage planId={planId} />;
}

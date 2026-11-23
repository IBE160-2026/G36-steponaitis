import { MoveListPage } from "@/modules/move-list/move-list-page";

export default async function Page({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  return <MoveListPage planId={planId} />;
}

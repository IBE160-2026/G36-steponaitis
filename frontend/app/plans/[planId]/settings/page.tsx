import { SettingsPage } from "@/modules/settings/settings-page";

export default async function Page({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  return <SettingsPage planId={planId} />;
}

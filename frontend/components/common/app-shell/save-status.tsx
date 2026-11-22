"use client";

// Save status (AD-12, UX-DR15): the autosave notices under the toolbar. The aria-live region is
// always rendered, so it exists before its content changes and the first notice is announced; the
// nested GlobalNotice drops its own role="status" so nothing is announced twice.

import { usePathname } from "next/navigation";

import { GlobalNotice } from "@/components/common/global-notice";
import { noticeText, SAVED_TEXT, type SaveNotice, usePlanCommands } from "@/lib/commands";
import { parsePlanPath } from "@/lib/view-state/urls";

export function SaveStatusView({ notice = null, saved = false }: { notice?: SaveNotice; saved?: boolean }) {
  const text = noticeText(notice);
  return (
    <div aria-live="polite" data-testid="save-status">
      {text ? (
        <GlobalNotice live={false}>{text}</GlobalNotice>
      ) : (
        saved && <span className="sr-only">{SAVED_TEXT}</span>
      )}
    </div>
  );
}

export function PlanSaveStatus() {
  const planPath = parsePlanPath(usePathname() ?? "");
  // Not keyed by plan: the live region stays mounted across plan changes. Off plan paths the
  // empty id has no commands, so the state is idle and the region stays empty.
  const { notice, saved } = usePlanCommands(planPath?.planId ?? "");
  return planPath ? <SaveStatusView notice={notice} saved={saved} /> : <SaveStatusView />;
}

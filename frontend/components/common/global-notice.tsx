// Global notice (UX-DR15): a full-width strip under the toolbar, e.g. "Save failed".

import type { ReactNode } from "react";

import { Icon } from "@/components/common/icons";

/** `live={false}` drops the notice's own `role="status"` when it sits inside another live region. */
export function GlobalNotice({ children, live = true }: { children: ReactNode; live?: boolean }) {
  return (
    <div
      role={live ? "status" : undefined}
      className="flex w-full items-center gap-2 border-b-2 border-ink bg-surface px-page-gutter py-2 text-ink type-body-strong"
    >
      <Icon name="warning" size={16} />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

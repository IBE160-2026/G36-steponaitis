// Global notice (UX-DR15): a full-width strip under the toolbar, e.g. "Save failed".

import type { ReactNode } from "react";

import { Icon } from "@/components/common/icons";

export function GlobalNotice({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex w-full items-center gap-2 border-b-2 border-ink bg-surface px-page-gutter py-2 text-ink type-body-strong"
    >
      <Icon name="warning" size={16} />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

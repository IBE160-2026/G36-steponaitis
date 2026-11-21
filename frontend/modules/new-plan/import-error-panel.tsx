// Import error panel (UX-DR20): a pale red alert with a red border and a warning triangle. For
// `import_invalid` it lists each failed file's messages as the server sent them (at most 20) and
// "and N more in this file"; for any other error it shows just the server's message.

import { Icon } from "@/components/common/icons";

import { IMPORT_STOPPED, type ImportErrorGroup, ROLE_LABELS } from "./selection";

export type PanelContent = { kind: "import"; groups: ImportErrorGroup[] } | { kind: "message"; message: string };

export function ImportErrorPanel({ id, content }: { id: string; content: PanelContent }) {
  return (
    <div
      id={id}
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-error bg-error-tint p-panel-padding text-ink"
    >
      <Icon name="warning" size={20} className="mt-px text-error" />
      <div className="flex min-w-0 flex-col gap-2 type-body">
        {content.kind === "import" ? (
          <>
            <p className="font-bold">{IMPORT_STOPPED}</p>
            {content.groups.map((group) => (
              <ul
                key={group.role}
                aria-label={`${ROLE_LABELS[group.role]} errors`}
                className="flex flex-col gap-1 break-words"
              >
                {group.lines.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
                {group.more && <li className="text-ink-secondary">{group.more}</li>}
              </ul>
            ))}
          </>
        ) : (
          <p>{content.message}</p>
        )}
      </div>
    </div>
  );
}

// Key (UX-DR45): always visible under the wall. Each entry is a 16 × 18 miniature of the real
// graphic with its glossary name, in a fixed order, never a colour word. Plain text in this
// story; Epic 11 turns the class entries into buttons.

import { useId } from "react";

import { KEY_LABELS, KEY_ORDER, KEY_TITLE, type KeyEntry } from "@/lib/copy";

import { BIN_HEIGHT, BIN_WIDTH, Bin } from "./bin";
import { Slot } from "./slot";

function Frame({ stroke, casing }: { stroke: string; casing?: string }) {
  return (
    <>
      {casing && (
        <rect x={-1} y={-1} width={BIN_WIDTH + 2} height={BIN_HEIGHT + 2} rx={3} fill="none" stroke={casing} strokeWidth={4} />
      )}
      <rect x={-1} y={-1} width={BIN_WIDTH + 2} height={BIN_HEIGHT + 2} rx={3} fill="none" stroke={stroke} strokeWidth={2} />
    </>
  );
}

function Miniature({ entry }: { entry: KeyEntry }) {
  switch (entry) {
    case "fast":
    case "medium":
    case "slow":
    case "dead":
      return <Bin parts={[entry]} />;
    case "empty":
      return <Slot />;
    case "best":
      // On paper the best green is the darker `best-on-light`.
      return (
        <>
          <Slot />
          <Frame stroke="var(--color-best-on-light)" />
        </>
      );
    case "selected":
      return (
        <>
          <Bin parts={["medium"]} />
          <Frame stroke="var(--color-accent)" casing="var(--color-slot-empty)" />
        </>
      );
    case "twoParts":
      return <Bin parts={["fast", "slow"]} />;
  }
}

export function KeySwatch({ entry }: { entry: KeyEntry }) {
  return (
    <svg
      width={16}
      height={18}
      viewBox={`-3 -3 ${BIN_WIDTH + 6} ${BIN_HEIGHT + 6}`}
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0 }}
      data-key-swatch={entry}
    >
      <Miniature entry={entry} />
    </svg>
  );
}

export function Key() {
  const titleId = useId();
  return (
    <div className="flex flex-col gap-1.5" data-wall-key="">
      <p id={titleId} className="type-caption font-medium text-ink">
        {KEY_TITLE}
      </p>
      <ul aria-labelledby={titleId} className="flex flex-wrap gap-x-5 gap-y-2">
        {KEY_ORDER.map((entry) => (
          <li key={entry} className="flex items-center gap-1.5 type-caption font-medium text-ink" data-key-entry={entry}>
            <KeySwatch entry={entry} />
            {KEY_LABELS[entry]}
          </li>
        ))}
      </ul>
    </div>
  );
}

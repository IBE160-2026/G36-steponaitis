// Key (UX-DR45): always visible under the wall. Each entry is a 16 × 18 miniature of the real
// graphic with its glossary name, in a fixed order, never a colour word. The six colour entries
// (Story 11.3, FR-42) are buttons that open the colour popover ("Slow-moving, change colour");
// Empty and 2 parts stay plain text. A kept change is announced in the Key's polite live region.
// This file stays server-safe (no "use client"): the buttons live in colour-popover.tsx.

import { useId } from "react";

import type { KeyColourEntry } from "@/lib/colours";
import { KEY_LABELS, KEY_ORDER, KEY_TITLE, type KeyEntry } from "@/lib/copy";

import { BIN_HEIGHT, BIN_WIDTH, Bin } from "./bin";
import { KeyColourAnnouncer, KeyColourButton } from "./colour-popover";
import { Slot } from "./slot";

/** A frame around a bin at (`x`, `y`): the best frame, or the Selected frame (accent over a casing). */
export function Frame({ stroke, casing, x = 0, y = 0 }: { stroke: string; casing?: string; x?: number; y?: number }) {
  return (
    <>
      {casing && (
        <rect x={x - 1} y={y - 1} width={BIN_WIDTH + 2} height={BIN_HEIGHT + 2} rx={3} fill="none" stroke={casing} strokeWidth={4} />
      )}
      <rect x={x - 1} y={y - 1} width={BIN_WIDTH + 2} height={BIN_HEIGHT + 2} rx={3} fill="none" stroke={stroke} strokeWidth={2} />
    </>
  );
}

/** The Selected look (Key "Selected"): the accent frame over a dark casing. */
export const SELECTED_FRAME = { stroke: "var(--color-accent)", casing: "var(--color-slot-empty)" } as const;

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
          <Frame {...SELECTED_FRAME} />
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

/** The Key entries whose colour the planner can change, and the colour each one sets. */
export const KEY_COLOUR_OF: Readonly<Partial<Record<KeyEntry, KeyColourEntry>>> = {
  fast: "fast",
  medium: "medium",
  slow: "slow",
  dead: "dead",
  best: "best",
  selected: "selection",
};

export function Key() {
  const titleId = useId();
  return (
    <div className="flex flex-col gap-1.5" data-wall-key="">
      <p id={titleId} className="type-caption font-medium text-ink">
        {KEY_TITLE}
      </p>
      <KeyColourAnnouncer>
        <ul aria-labelledby={titleId} className="flex flex-wrap gap-x-5 gap-y-2">
          {KEY_ORDER.map((entry) => {
            const colour = KEY_COLOUR_OF[entry];
            return (
              <li key={entry} className="flex items-center gap-1.5 type-caption font-medium text-ink" data-key-entry={entry}>
                {colour ? (
                  <KeyColourButton entry={colour} label={KEY_LABELS[entry]} swatch={<KeySwatch entry={entry} />} />
                ) : (
                  <>
                    <KeySwatch entry={entry} />
                    {KEY_LABELS[entry]}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </KeyColourAnnouncer>
    </div>
  );
}

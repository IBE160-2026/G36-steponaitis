"use client";

// Other location ▾ (Story 7.2, FR-31, UX-DR36): a recommendation detail action that opens a
// listbox of the server's allowed set (AD-3: the client never computes it). The listbox takes
// focus when it opens; arrows, Home/End and typing only move the highlight; `Enter` or a click
// applies the highlighted location; `Esc` closes and returns focus to the trigger. There is no
// free-text entry: any other placement is a manual move.

import { Popover } from "radix-ui";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/common/button";
import { Listbox } from "@/components/common/listbox";
import { type LocationRef, type RecommendationRow, usePlanOtherLocations } from "@/lib/api/plans";
import {
  LOADING_LOCATIONS,
  LOCATIONS_LOAD_FAILED,
  noOtherLocationText,
  OTHER_LOCATION_LABEL,
  OTHER_LOCATIONS_LIST,
  otherLocationBestText,
  otherLocationOptionMeta,
  otherLocationOptionName,
} from "@/lib/copy";

/** What the recommendations view hands the action: the row, the open state and the apply. */
export type OtherLocationActionProps = {
  row: RecommendationRow;
  /** The version of the view the row comes from: an allowed set of another version is not shown. */
  version: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Why it is disabled (the same reason as Apply); undefined when it can open. */
  disabledReason: string | undefined;
  /** Applies the recommendation to `location` (the view sends `apply_other_location`). */
  onApply: (location: string) => void;
};

export type OtherLocationMenuProps = OtherLocationActionProps & {
  /** The server's allowed set; undefined while it loads. */
  locations: readonly LocationRef[] | undefined;
  /** The set could not be loaded. */
  failed?: boolean;
};

function OptionContent({ location }: { location: LocationRef }) {
  return (
    <span aria-hidden="true" className="flex w-full min-w-0 items-center justify-between gap-3">
      <span className="flex min-w-0 flex-col">
        <span className="type-code-table text-ink">{location.code}</span>
        <span className="type-caption text-ink-secondary">{otherLocationOptionMeta(location)}</span>
      </span>
      {location.is_best ? (
        <span className="rounded-xs border border-best-on-light px-1 py-0.5 text-best-on-light type-tag">
          {otherLocationBestText(true)}
        </span>
      ) : (
        <span className="type-meta text-ink-secondary">{otherLocationBestText(false)}</span>
      )}
    </span>
  );
}

export type OtherLocationListProps = {
  rule: RecommendationRow["rule"];
  /** The server's allowed set; undefined while it loads. */
  locations: readonly LocationRef[] | undefined;
  /** The set could not be loaded (shown instead of the loading text). */
  failed?: boolean;
  /** The highlighted code; an unknown or missing one highlights the first location. */
  highlighted: string | undefined;
  /** Arrows, Home/End, typing and a click move the highlight (never apply). */
  onHighlight: (code: string) => void;
  /** `Enter` or a click applies the location. */
  onApply: (code: string) => void;
};

/** The popover's body: "Loading locations…", the load error, the empty-set sentence or the
 * listbox (hook-free). */
export function OtherLocationList({ rule, locations, failed = false, highlighted, onHighlight, onApply }: OtherLocationListProps) {
  if (locations === undefined && failed) {
    return (
      <p role="alert" className="px-2 py-1 type-body text-ink">
        {LOCATIONS_LOAD_FAILED}
      </p>
    );
  }
  if (locations === undefined) {
    return (
      <p role="status" className="px-2 py-1 type-body text-ink-secondary">
        {LOADING_LOCATIONS}
      </p>
    );
  }
  if (locations.length === 0) {
    return (
      <p role="status" className="px-2 py-1 type-body text-ink">
        {noOtherLocationText(rule)}
      </p>
    );
  }
  const highlight = locations.some((location) => location.code === highlighted) ? highlighted : locations[0].code;
  return (
    <Listbox
      label={OTHER_LOCATIONS_LIST}
      options={locations}
      optionKey={(location) => location.code}
      optionLabel={otherLocationOptionName}
      typeaheadText={(location) => location.code}
      renderOption={(location) => <OptionContent location={location} />}
      selectedKey={highlight}
      onSelect={(location) => onHighlight(location.code)}
      onActivate={(location) => onApply(location.code)}
      className="border-0 py-0"
    />
  );
}

/** The trigger and its popover listbox, given the allowed set (testable without a server). */
export function OtherLocationMenu({
  row,
  open,
  onOpenChange,
  disabledReason,
  onApply,
  locations,
  failed = false,
}: OtherLocationMenuProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [highlighted, setHighlighted] = useState<string | undefined>(undefined);

  // The listbox takes focus once it renders (it may arrive after the popover opens).
  const hasList = open && locations !== undefined && locations.length > 0;
  useEffect(() => {
    if (hasList) content.current?.querySelector<HTMLElement>('[role="listbox"]')?.focus();
  }, [hasList]);

  function apply(code: string) {
    setHighlighted(undefined);
    onOpenChange(false);
    onApply(code);
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setHighlighted(undefined);
        onOpenChange(next);
      }}
    >
      <Popover.Anchor asChild>
        <span className="inline-flex">
          <Button
            ref={trigger}
            variant="tertiary"
            size="md"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-keyshortcuts="Alt+O"
            disabledReason={disabledReason}
            onClick={() => onOpenChange(true)}
          >
            {OTHER_LOCATION_LABEL}
            <span aria-hidden="true">▾</span>
          </Button>
        </span>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          ref={content}
          aria-label={OTHER_LOCATIONS_LIST}
          align="start"
          sideOffset={6}
          collisionPadding={16}
          className="z-50 flex w-[min(320px,calc(100vw-32px))] flex-col gap-2 rounded-lg border border-border bg-surface p-2 text-ink shadow-overlay"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            content.current?.querySelector<HTMLElement>('[role="listbox"]')?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <OtherLocationList
            rule={row.rule}
            locations={locations}
            failed={failed}
            highlighted={highlighted}
            onHighlight={setHighlighted}
            onApply={apply}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The action with the server's allowed set, fetched while the listbox is open. */
export function OtherLocationAction({ planId, ...props }: OtherLocationActionProps & { planId: string }) {
  const query = usePlanOtherLocations(planId, props.row.id, props.open);
  // A set of another recommendation or another plan version (a refetch is on its way) is not shown.
  const data = query.data;
  const current = data && data.recommendation_id === props.row.id && data.version === props.version;
  return <OtherLocationMenu {...props} locations={current ? data.locations : undefined} failed={query.isError} />;
}

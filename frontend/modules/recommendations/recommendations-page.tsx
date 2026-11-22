"use client";

// Recommendations step (FR-23–FR-30, UX-DR8, UX-DR13, UX-DR31–35, UX-DR57, Story 5.7): run the
// rules, read the rows per state tab under their rule bands, apply one or all, and keep a part in
// place (Story 7.1, FR-32: the shared Keep in place link and `Alt+K`), and apply one to another
// allowed location (Story 7.2, FR-31: Other location ▾ and `Alt+O`). Everything shown
// comes from GET /api/plans/{id}/recommendations and the plan summary, rendered as one
// version-consistent set (AD-12); status, BEST, class and order are the server's (AD-3, AD-14). Every
// command goes through lib/commands; a 409 is the command client's (server message + refetch).

import { useSearchParams } from "next/navigation";
import { Popover, Tabs } from "radix-ui";
import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { BinSwatch } from "@/components/common/bin-swatch";
import { Button } from "@/components/common/button";
import { ManualMoveDialog } from "@/components/common/manual-move-dialog";
import { Icon } from "@/components/common/icons";
import { KeepInPlaceButton, KeptInPlaceMark, sendKeep } from "@/components/common/keep-in-place";
import { MANUAL_MOVE_LABEL, manualMoveReason } from "@/components/common/part-panel";
import { PlanLoadError, PlanOpening, showsLoadError } from "@/components/common/plan-status";
import { showToast } from "@/components/common/toast";
import {
  type CommandEvent,
  type PlanSummary,
  type RecommendationRow,
  type RecommendationsView as RecommendationsData,
  usePlanPart,
  usePlanRecommendations,
  usePlanSummary,
} from "@/lib/api/plans";
import { type CommandBody, type SendResult, useConsistentPlanQueries, usePlanCommands } from "@/lib/commands";
import {
  appliedText,
  appliedToast,
  applyAllQuestion,
  applyAllToast,
  KEPT_IN_PLACE,
  keptApplyReason,
  NO_OPEN_TO_APPLY,
  noSpaceText,
  outdatedText,
  reasonSegments,
  runAnnouncement,
  runLine,
} from "@/lib/copy";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { parseRecommendationsTab, type RecommendationsTab, recommendationsTabHref } from "@/lib/view-state/urls";
import {
  type BandView,
  bandViews,
  collapseNoSpace,
  effectiveTo,
  EMPTY_TAB,
  groupByRule,
  bandMeta,
  isApplyShortcut,
  isKept,
  isKeepShortcut,
  isOtherLocationShortcut,
  itemId,
  type ListItem,
  moreLikeThisText,
  nextOptionIndex,
  optionName,
  type Rule,
  RULE_BANDS,
  ROWS_PER_RULE,
  ruleNumber,
  showMoreText,
  showsKeepLink,
  TABS,
  tabCounts,
  tabItems,
  tabName,
} from "./list";
import { OtherLocationAction, type OtherLocationActionProps } from "./other-location";

export const RUN_LABEL = "Run recommendations";
export const RUNNING_LABEL = "Running…";
export const LOADING_PART = "Loading the part…";
export const NO_BEST_NOTE = "Rule 1 and rule 2 need best locations. Rule 3 runs without them.";
export const NO_RUN = "No run yet. Run recommendations to start round 1 on the planning copy as it is now.";

export function nextRunText(round: number): string {
  return `The next run starts round ${formatNumber(round + 1)} and uses the planning copy as it is then.`;
}

export function failedRunText(round: number): string {
  return `The run stopped before it finished. Nothing changed: still round ${formatNumber(round)}. Run recommendations to try again.`;
}

export function emptyRunText(round: number): string {
  return `Round ${formatNumber(round)} found no recommendations and no “no space” parts. The rules have nothing more to suggest for these best-location marks.`;
}

/** The detail eyebrow: "SELECTED · #1 · RULE 1", "SELECTED · NO SPACE · RULE 3" or "SELECTED · KEPT IN PLACE". */
export function eyebrowText(item: ListItem): string {
  if (item.kind === "kept-part") return `SELECTED · ${KEPT_IN_PLACE.toUpperCase()}`;
  const rule = `RULE ${ruleNumber(item.row.rule)}`;
  return item.kind === "rec" ? `SELECTED · #${formatNumber(item.row.number)} · ${rule}` : `SELECTED · NO SPACE · ${rule}`;
}

/** Why Apply is disabled: the outdated cause, else "<part> is kept in place.", else the saving
 * reason; undefined when it can apply. */
export function applyReason(row: RecommendationRow, savingReason: string | undefined): string | undefined {
  if (row.status === "outdated" && row.outdated) return outdatedText(row.part, row.outdated);
  if (row.status === "kept") return keptApplyReason(row.part);
  return savingReason;
}

function findEvent<T extends CommandEvent["type"]>(events: readonly CommandEvent[], type: T) {
  return events.find((event): event is Extract<CommandEvent, { type: T }> => event.type === type);
}

function BestTag() {
  return (
    <span className="rounded-xs border border-best-on-light px-1 py-0.5 text-best-on-light type-tag">BEST</span>
  );
}

function NoSpaceChip() {
  return <span className="rounded-xs bg-ink px-1 py-0.5 text-surface type-tag">NO SPACE</span>;
}

const HATCH = {
  backgroundImage:
    "repeating-linear-gradient(135deg, var(--color-hatch-stripe) 0 1px, transparent 1px 7px)",
};

function RowLine({ item }: { item: ListItem }) {
  if (item.kind === "kept-part") return <KeptInPlaceMark label={KEPT_IN_PLACE} className="type-reason text-ink-secondary" />;
  if (item.kind === "no-space") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1 type-reason text-ink-secondary">
        {item.row.kept_in_place && (
          <>
            <KeptInPlaceMark label={KEPT_IN_PLACE} className="text-ink-secondary" />
            <span aria-hidden="true">·</span>
          </>
        )}
        <span>{noSpaceText(item.row.cause)}</span>
      </span>
    );
  }
  const row = item.row;
  if (row.status === "applied" && row.applied) {
    return (
      <span className="inline-flex items-center gap-1 type-reason text-ink-secondary">
        <Icon name="check" size={14} />
        {appliedText(row.applied)}
      </span>
    );
  }
  if (row.status === "outdated" && row.outdated) {
    return (
      <span className="inline-flex items-center gap-1 type-reason text-ink-secondary">
        <Icon name="clock" size={14} />
        <span className="font-semibold">Outdated</span>
        <span>· {outdatedText(row.part, row.outdated)}</span>
      </span>
    );
  }
  if (row.status === "kept") return <KeptInPlaceMark label={KEPT_IN_PLACE} className="type-reason text-ink-secondary" />;
  return null;
}

function OptionRow({ item }: { item: ListItem }) {
  const row = item.row;
  const outdated = item.kind === "rec" && item.row.status === "outdated";
  return (
    <div aria-hidden="true" className="grid grid-cols-[28px_16px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1">
      <span className="type-code-table text-ink-secondary">
        {item.kind === "rec" ? `#${formatNumber(item.row.number)}` : ""}
      </span>
      <span className="pt-0.5">{row.movement_class && <BinSwatch movementClass={row.movement_class} />}</span>
      <span className="flex min-w-0 flex-col">
        <span className="type-part-number text-ink">{row.part}</span>
        <span className="truncate type-caption text-ink-secondary">{row.description}</span>
      </span>
      <span className="type-code-table text-right text-ink">{row.picks === null ? "" : formatNumber(row.picks)}</span>
      <span />
      <span />
      <span className="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex flex-wrap items-center gap-1 type-code-table text-ink">
          <span>{row.from_location ?? "—"}</span>
          {row.from_best && <BestTag />}
          {item.kind !== "kept-part" && <span aria-hidden="true">→</span>}
          {item.kind === "rec" ? (
            <>
              <span className={cn(outdated && "line-through")}>{effectiveTo(item.row).location}</span>
              {effectiveTo(item.row).best && <BestTag />}
            </>
          ) : item.kind === "no-space" ? (
            <NoSpaceChip />
          ) : null}
        </span>
        <RowLine item={item} />
      </span>
    </div>
  );
}

function Detail({
  id,
  item,
  savingReason,
  onApply,
  onKeep,
  manualMove,
  otherLocation,
}: {
  id: string;
  item: ListItem | undefined;
  savingReason: string | undefined;
  onApply: (row: RecommendationRow) => void;
  onKeep: (item: ListItem) => void;
  manualMove: (part: string) => ReactNode;
  /** The Other location ▾ action of an open recommendation (between Apply and Keep in place). */
  otherLocation: (row: RecommendationRow) => ReactNode;
}) {
  if (!item) {
    return <section id={id} aria-label="Selected recommendation" className="min-w-0" />;
  }
  const row = item.row;
  const keepLink = showsKeepLink(item) ? (
    <KeepInPlaceButton
      kept={isKept(item)}
      savingReason={savingReason}
      keyShortcut="Alt+K"
      onClick={() => onKeep(item)}
    />
  ) : null;
  const keptLine = isKept(item) ? <KeptInPlaceMark label={KEPT_IN_PLACE} size={16} className="type-body text-ink" /> : null;
  return (
    <section
      id={id}
      aria-label="Selected recommendation"
      className="flex min-w-0 flex-col gap-3 self-start rounded-lg border border-border bg-surface p-panel-padding"
    >
      <p className="type-marker tracking-wide text-ink-secondary" data-testid="detail-eyebrow">
        {eyebrowText(item)}
      </p>
      <div className="flex items-center gap-2">
        {row.movement_class && <BinSwatch movementClass={row.movement_class} />}
        <h2 className="type-section-title text-ink">{row.part}</h2>
      </div>
      {row.description && <p className="-mt-2 type-body text-ink-secondary">{row.description}</p>}
      {item.kind !== "kept-part" && item.row.reason && (
        <p className="type-body text-ink" data-testid="detail-reason">
          {reasonSegments(item.row.reason).map((segment, index) =>
            segment.strong ? <strong key={index}>{segment.text}</strong> : <span key={index}>{segment.text}</span>,
          )}
        </p>
      )}
      <p className="inline-flex flex-wrap items-center gap-2 type-code text-ink">
        <span>{row.from_location ?? "No current location"}</span>
        {row.from_best && <BestTag />}
        {item.kind !== "kept-part" && (
          <>
            <span aria-hidden="true">→</span>
            <span className="sr-only">to</span>
          </>
        )}
        {item.kind === "rec" ? (
          <>
            <span className={cn(item.row.status === "outdated" && "line-through")}>
              {effectiveTo(item.row).location}
            </span>
            {effectiveTo(item.row).best && <BestTag />}
          </>
        ) : item.kind === "no-space" ? (
          <NoSpaceChip />
        ) : null}
      </p>
      {item.kind === "kept-part" ? (
        <>
          {keptLine}
          <div className="flex flex-wrap items-center gap-2">
            {keepLink}
            {manualMove(row.part)}
          </div>
        </>
      ) : item.kind === "no-space" ? (
        <>
          {keptLine}
          <p className="type-body text-ink">{noSpaceText(item.row.cause)}</p>
          <div className="flex flex-wrap items-center gap-2">
            {keepLink}
            {manualMove(row.part)}
          </div>
        </>
      ) : item.row.status === "applied" && item.row.applied ? (
        <p className="inline-flex items-center gap-1 type-body text-ink">
          <Icon name="check" />
          {appliedText(item.row.applied)}
        </p>
      ) : (
        <>
          {item.row.status === "outdated" && item.row.outdated && (
            <p className="inline-flex items-center gap-1 type-body text-ink">
              <Icon name="clock" />
              Outdated · {outdatedText(item.row.part, item.row.outdated)}
            </p>
          )}
          {keptLine}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="md"
              aria-keyshortcuts="Alt+A"
              disabledReason={applyReason(item.row, savingReason)}
              onClick={() => onApply(item.row)}
            >
              Apply
            </Button>
            {otherLocation(item.row)}
            {keepLink}
            {manualMove(row.part)}
          </div>
        </>
      )}
    </section>
  );
}

function ApplyAll({
  count,
  round,
  savingReason,
  onConfirm,
}: {
  count: number;
  round: number;
  savingReason: string | undefined;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const reason = count === 0 ? NO_OPEN_TO_APPLY : savingReason;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <span className="inline-flex">
          <Button
            ref={trigger}
            variant="secondary"
            size="md"
            aria-haspopup="dialog"
            aria-expanded={open}
            disabledReason={reason}
            onClick={() => setOpen(true)}
          >
            Apply all ({formatNumber(count)})
          </Button>
        </span>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          role="dialog"
          aria-label="Apply all"
          align="end"
          sideOffset={6}
          collisionPadding={16}
          className="z-50 flex w-[min(360px,calc(100vw-32px))] flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-ink shadow-overlay"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancel.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <p className="type-body text-ink">{applyAllQuestion(count, round)}</p>
          <div className="flex justify-end gap-2">
            <Button ref={cancel} variant="tertiary" size="md" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabledReason={reason}
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              Apply all
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function RecommendationList({
  bands,
  detailId,
  selectedId,
  onSelect,
  onShowMore,
  onMoreLikeThis,
  optionRefs,
}: {
  bands: readonly BandView[];
  detailId: string;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onShowMore: (rule: Rule) => void;
  onMoreLikeThis: (key: string) => void;
  optionRefs: RefObject<Map<string, HTMLElement>>;
}) {
  const bandId = useId();
  const visible = bands.flatMap((band) => band.rows.map((row) => row.item));

  function onOptionKeyDown(event: KeyboardEvent<HTMLDivElement>, index: number) {
    // Only the option's own keys: never steal keys from a button inside the list (retro item 15).
    if (event.target !== event.currentTarget) return;
    const next = nextOptionIndex(event.key, index, visible.length);
    if (next === null) return;
    event.preventDefault();
    onSelect(itemId(visible[next]));
  }

  return (
    <div role="listbox" aria-label="Recommendations" aria-controls={detailId} className="flex min-w-0 flex-col gap-3">
      {bands.map((band) => {
        const meta = bandMeta(band.rule);
        const labelId = `${bandId}-${band.rule}`;
        return (
          <div key={band.rule} role="group" aria-labelledby={labelId} className="flex flex-col">
            <div
              id={labelId}
              className="flex min-h-rule-band flex-wrap items-center gap-x-3 gap-y-1 rounded-t-lg bg-band px-3 py-1"
            >
              <span className="rounded-xs bg-ink px-1.5 py-0.5 text-surface type-tag">{meta.tag}</span>
              <span className="type-body-strong text-ink">{meta.name}</span>
              <span className="type-meta text-ink-secondary">{meta.note}</span>
            </div>
            <div className="flex flex-col divide-y divide-hairline rounded-b-lg border border-t-0 border-border bg-surface">
              {band.rows.map(({ item, moreLikeThis }) => {
                const id = itemId(item);
                const index = visible.indexOf(item);
                const selected = id === selectedId;
                const outdated = item.kind === "rec" && item.row.status === "outdated";
                return (
                  <div key={id} className="flex flex-col">
                    <div
                      role="option"
                      aria-selected={selected}
                      aria-label={optionName(item)}
                      tabIndex={selected ? 0 : -1}
                      data-item-id={id}
                      ref={(element) => {
                        if (element) optionRefs.current.set(id, element);
                        else optionRefs.current.delete(id);
                      }}
                      onClick={() => onSelect(id)}
                      onKeyDown={(event) => onOptionKeyDown(event, index)}
                      style={outdated ? HATCH : undefined}
                      className={cn(
                        "relative min-h-recommendation-row cursor-pointer py-2 pr-3 pl-4 outline-offset-[-2px]",
                        selected && "bg-selected-tint outline-1 outline-ink outline-solid",
                      )}
                    >
                      {selected && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-accent" />}
                      <OptionRow item={item} />
                    </div>
                    {moreLikeThis && (
                      <div className="pr-3 pb-2 pl-[60px]">
                        <Button variant="link" size="sm" onClick={() => onMoreLikeThis(moreLikeThis.key)}>
                          {moreLikeThisText(moreLikeThis.count)}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
              {band.more && band.rule !== "kept" && (
                <div className="px-4 py-2">
                  <Button variant="link" size="sm" onClick={() => onShowMore(band.rule as Rule)}>
                    {showMoreText(band.more.count, band.rule)}
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type RecommendationsViewProps = {
  summary: PlanSummary;
  view: RecommendationsData;
  tab: RecommendationsTab;
  onTabChange: (tab: RecommendationsTab) => void;
  /** "Saving the last change…" while a command is unconfirmed (lib/commands). */
  disabledReason?: string;
  onSend: (body: CommandBody) => Promise<SendResult>;
  /** The Manual move… action for a part (the page wires the shared ManualMoveDialog). */
  manualMove?: (part: string) => ReactNode;
  /** The Other location ▾ action (the page wires `OtherLocationAction` with the server's set). */
  otherLocation?: (props: OtherLocationActionProps) => ReactNode;
  notify?: (message: string) => void;
};

export function RecommendationsView({
  summary,
  view,
  tab,
  onTabChange,
  disabledReason,
  onSend,
  manualMove = () => null,
  otherLocation = () => null,
  notify = showToast,
}: RecommendationsViewProps) {
  const [running, setRunning] = useState(false);
  const [failedRound, setFailedRound] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [chosenId, setChosenId] = useState<string | undefined>(undefined);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [focusRequest, setFocusRequest] = useState(0);
  // The recommendation whose Other location ▾ listbox is open (Alt+O or the trigger).
  const [otherOpenId, setOtherOpenId] = useState<string | undefined>(undefined);
  // A focus request waits for its row: it is kept until its tab shows a view of at least
  // `minVersion`, then focuses the selected row there, or is dropped when that view has none.
  const pendingFocus = useRef<{ minVersion: number; tab: RecommendationsTab } | null>(null);
  const region = useRef<HTMLDivElement>(null);
  const runButton = useRef<HTMLButtonElement>(null);
  // Set when a run failed: the Run button is focused once it renders enabled again (the disabled
  // Button is a different element, so focusing before that render would be lost).
  const refocusRun = useRef(false);
  const optionRefs = useRef(new Map<string, HTMLElement>());
  const detailId = useId();

  const round = view.run?.round ?? 0;
  const counts = tabCounts(view);
  const items = tabItems(view, tab);
  const bands = bandViews(
    tab,
    items,
    new Set(RULE_BANDS.map((band) => band.rule).filter((rule) => expanded.has(`${tab}:${rule}`))),
    expanded,
  );
  const visible = bands.flatMap((band) => band.rows.map((row) => row.item));
  // Selection is kept by id while the row is visible in this tab, else the first visible row.
  const selected = visible.find((item) => itemId(item) === chosenId) ?? visible[0];
  const selectedId = selected ? itemId(selected) : undefined;
  const savingReason = running ? (disabledReason ?? RUNNING_LABEL) : disabledReason;
  // The Other location listbox closes when the tab or the selected row changes, so it never
  // reopens when that row's detail mounts again.
  const [otherFor, setOtherFor] = useState({ tab, selectedId });
  if (otherFor.tab !== tab || otherFor.selectedId !== selectedId) {
    setOtherFor({ tab, selectedId });
    setOtherOpenId(undefined);
  }

  useEffect(() => {
    const pending = pendingFocus.current;
    if (pending === null || pending.tab !== tab || view.version < pending.minVersion) return;
    const element = selectedId === undefined ? undefined : optionRefs.current.get(selectedId);
    element?.focus();
    pendingFocus.current = null;
  }, [focusRequest, selectedId, view.version, tab]);

  const requestFocus = useCallback((minVersion: number, onTab: RecommendationsTab) => {
    pendingFocus.current = { minVersion, tab: onTab };
    setFocusRequest((n) => n + 1);
  }, []);

  const select = useCallback(
    (id: string) => {
      setChosenId(id);
      requestFocus(view.version, tab);
    },
    [requestFocus, view.version, tab],
  );

  /** Expands `key` and selects the first row it shows, so focus does not fall off the removed button. */
  function expandTo(key: string, first: ListItem | undefined) {
    setExpanded((prev) => new Set(prev).add(key));
    if (first) select(itemId(first));
  }

  function showMore(rule: Rule) {
    const ruleItems = items.filter((item) => item.kind !== "kept-part" && item.row.rule === rule);
    expandTo(`${tab}:${rule}`, ruleItems[ROWS_PER_RULE]);
  }

  function showMoreLikeThis(key: string) {
    const runs = groupByRule(items).flatMap((group) => collapseNoSpace(group.items));
    expandTo(key, runs.find((candidate) => itemId(candidate.first) === key)?.rest[0]);
  }

  async function run() {
    setFailedRound(null);
    setRunning(true);
    const before = view.version;
    let result: SendResult;
    try {
      result = await onSend({ type: "run" });
    } finally {
      setRunning(false);
    }
    if (result.outcome === "confirmed") {
      const done = findEvent(result.events, "run_done");
      if (done) setAnnouncement(runAnnouncement(done));
      setChosenId(undefined);
      setExpanded(new Set());
      onTabChange("open");
      requestFocus(before + 1, "open");
    } else if (result.outcome === "dropped") {
      setFailedRound(round);
      refocusRun.current = true;
    }
  }

  /** Sends an apply (to the suggested or another location), toasts its `move_made` and moves focus. */
  async function sendApply(body: CommandBody) {
    const before = view.version;
    const result = await onSend(body);
    if (result.outcome !== "confirmed") return;
    const moved = findEvent(result.events, "move_made");
    if (moved) notify(appliedToast(moved));
    // The applied row leaves the tab: when focus was in the list or detail (or already fell to the
    // page), it moves to the selected row of the refreshed view.
    const active = typeof document === "undefined" ? null : document.activeElement;
    if (!active || active === document.body || region.current?.contains(active)) requestFocus(before + 1, tab);
  }

  function apply(row: RecommendationRow) {
    return sendApply({ type: "apply", recommendation_id: row.id });
  }

  function applyOther(row: RecommendationRow, location: string) {
    return sendApply({ type: "apply_other_location", recommendation_id: row.id, to_location: location });
  }

  async function keep(item: ListItem) {
    const before = view.version;
    const result = await sendKeep(onSend, item.row.part, isKept(item), notify);
    if (result.outcome !== "confirmed" || result.events.length === 0) return;
    // The row leaves its tab (Open or No space to Kept, Kept back to its own): focus follows the
    // same pending-focus rule as Apply.
    const active = typeof document === "undefined" ? null : document.activeElement;
    if (!active || active === document.body || region.current?.contains(active)) requestFocus(before + 1, tab);
  }

  async function applyAll() {
    const result = await onSend({ type: "apply_all" });
    if (result.outcome !== "confirmed") return;
    const done = findEvent(result.events, "apply_all_done");
    if (done) notify(applyAllToast(done, round));
  }

  function onRegionKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // React portal events (the ManualMoveDialog) bubble here too; only keys from this region count.
    if (!event.currentTarget.contains(event.target as Node)) return;
    const keys = { altKey: event.altKey, code: event.code, target: event.target as HTMLElement };
    if (isKeepShortcut(keys)) {
      if (!selected || !showsKeepLink(selected)) return;
      event.preventDefault();
      if (savingReason !== undefined) return;
      void keep(selected);
      return;
    }
    if (isOtherLocationShortcut(keys)) {
      if (selected?.kind !== "rec" || selected.row.status !== "open") return;
      event.preventDefault();
      if (applyReason(selected.row, savingReason) !== undefined) return;
      setOtherOpenId(selected.row.id);
      return;
    }
    if (!isApplyShortcut(keys)) return;
    if (selected?.kind !== "rec" || selected.row.status !== "open") return;
    event.preventDefault();
    if (applyReason(selected.row, savingReason) !== undefined) return;
    void apply(selected.row);
  }

  useEffect(() => {
    if (!refocusRun.current || savingReason !== undefined) return;
    runButton.current?.focus();
    refocusRun.current = false;
  }, [failedRound, savingReason]);
  const hasRun = view.run !== null;
  const emptyRun = hasRun && view.recommendations.length === 0 && view.no_space.length === 0;
  // Kept parts stay reachable on the Kept in place tab before the first run and after an empty run.
  const showTabs = (hasRun && !emptyRun) || view.kept_parts.length > 0;

  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="type-page-title">Recommendations</h1>
            <span className="rounded-full border border-ink px-2.5 py-1 type-marker text-ink" data-testid="round-chip">
              Round {formatNumber(round)}
            </span>
          </div>
          {view.run && (
            <>
              <p className="type-body text-ink" data-testid="run-line">
                {runLine(view.run, view.recommendations.length, view.no_space.length)}
              </p>
              <p className="type-caption text-ink-secondary">{nextRunText(view.run.round)}</p>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button ref={runButton} variant="secondary" size="md" disabledReason={savingReason} onClick={() => void run()}>
            {running ? RUNNING_LABEL : RUN_LABEL}
          </Button>
          <ApplyAll
            count={summary.apply_all_count}
            round={round}
            savingReason={savingReason}
            onConfirm={() => void applyAll()}
          />
        </div>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {failedRound !== null && (
        <p role="alert" className="type-body text-ink">
          {failedRunText(failedRound)}
        </p>
      )}
      {summary.best_locations === 0 && <p className="type-body text-ink-secondary">{NO_BEST_NOTE}</p>}
      <div
        inert={running}
        className={cn("flex min-w-0 flex-col gap-4 transition-opacity", running && "opacity-50")}
        data-testid="recommendations-area"
      >
        {!hasRun && <p className="type-body text-ink-secondary">{NO_RUN}</p>}
        {emptyRun && <p className="type-body text-ink-secondary">{emptyRunText(round)}</p>}
        {showTabs && (
          <Tabs.Root value={tab} onValueChange={(value) => onTabChange(value as RecommendationsTab)}>
            <Tabs.List aria-label="Recommendation states" className="flex flex-wrap gap-1 border-b border-border">
              {TABS.map(({ value, label }) => (
                <Tabs.Trigger
                  key={value}
                  value={value}
                  aria-label={tabName(value, counts[value])}
                  className="-mb-px inline-flex h-control-lg items-center gap-2 border-b-2 border-transparent px-3 type-tab text-ink-secondary data-[state=active]:border-ink data-[state=active]:text-ink"
                >
                  {label}
                  <span className="rounded-full bg-band px-1.5 py-0.5 type-meta text-ink">{formatNumber(counts[value])}</span>
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            {TABS.map(({ value }) => (
              <Tabs.Content key={value} value={value} className="pt-4 outline-none">
                {items.length === 0 ? (
                  <p className="type-body text-ink-secondary">{EMPTY_TAB[value]}</p>
                ) : (
                  <div
                    className="grid min-w-0 gap-4 xl:grid-cols-[640px_minmax(0,1fr)]"
                    ref={region}
                    onKeyDown={onRegionKeyDown}
                  >
                    <RecommendationList
                      bands={bands}
                      detailId={detailId}
                      selectedId={selectedId}
                      onSelect={select}
                      onShowMore={showMore}
                      onMoreLikeThis={showMoreLikeThis}
                      optionRefs={optionRefs}
                    />
                    <Detail
                      id={detailId}
                      item={selected}
                      savingReason={savingReason}
                      onApply={(row) => void apply(row)}
                      onKeep={(item) => void keep(item)}
                      manualMove={manualMove}
                      otherLocation={(row) =>
                        otherLocation({
                          row,
                          version: view.version,
                          open: otherOpenId === row.id,
                          onOpenChange: (open) => setOtherOpenId(open ? row.id : undefined),
                          disabledReason: applyReason(row, savingReason),
                          onApply: (location) => void applyOther(row, location),
                        })
                      }
                    />
                  </div>
                )}
              </Tabs.Content>
            ))}
          </Tabs.Root>
        )}
      </div>
    </div>
  );
}

function ManualMoveAction({ planId, part, savingReason }: { planId: string; part: string; savingReason?: string }) {
  const detail = usePlanPart(planId, part);
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const reason = detail.data && detail.data.part === part ? manualMoveReason(detail.data, savingReason) : LOADING_PART;
  return (
    <>
      <Button ref={button} variant="tertiary" size="md" disabledReason={reason} onClick={() => setOpen(true)}>
        {MANUAL_MOVE_LABEL}
      </Button>
      {detail.data && (
        <ManualMoveDialog planId={planId} detail={detail.data} open={open} onOpenChange={setOpen} returnFocusRef={button} />
      )}
    </>
  );
}

export function RecommendationsPage({ planId }: { planId: string }) {
  const summary = usePlanSummary(planId);
  const recommendations = usePlanRecommendations(planId);
  const data = useConsistentPlanQueries([summary, recommendations]);
  const { sendWithEvents, disabledReason } = usePlanCommands(planId);
  const tab = parseRecommendationsTab(useSearchParams());
  const changeTab = useCallback(
    (next: RecommendationsTab) => window.history.replaceState(null, "", recommendationsTabHref(planId, next)),
    [planId],
  );
  if (data) {
    const [summaryData, view] = data;
    return (
      <RecommendationsView
        summary={summaryData}
        view={view}
        tab={tab}
        onTabChange={changeTab}
        disabledReason={disabledReason}
        onSend={sendWithEvents}
        manualMove={(part) => <ManualMoveAction key={part} planId={planId} part={part} savingReason={disabledReason} />}
        otherLocation={(props) => <OtherLocationAction key={props.row.id} planId={planId} {...props} />}
      />
    );
  }
  const error = summary.error ?? recommendations.error;
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      {showsLoadError(error) ? <PlanLoadError message={error.message} /> : <PlanOpening planId={planId} />}
    </div>
  );
}

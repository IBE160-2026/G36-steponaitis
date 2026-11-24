"use client";

// Launcher (UX-DR7, UX-DR8, UJ-8, Story 6.5): the toolbar grid button and the flow map drawer, a
// modal dialog opened by the button or `Ctrl+K` / `⌘K` (also inside text fields). Eight step
// columns with their state, live counts (plan summary only, AD-3) and registered actions, a band
// with the plans, SAV/NEW/SET, the stage-2 plates (CAT opens Categories; LBL is inert) and the Keyboard box. Typing replaces the
// columns with grouped results. Everything that is not a flow step comes from the data lists in
// lib/launcher; an action appended to `LAUNCHER_ACTIONS` shows here with no change to this file.
// While the drawer is open, `#content` and the toolbar are `inert`; closing drops `inert` first and
// then returns focus to the grid button (it sits inside the toolbar).

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import {
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { plateMeta, RECENT_PLANS_MAX } from "@/components/common/app-shell/plan-plate";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Icon } from "@/components/common/icons";
import { showToast } from "@/components/common/toast";
import { type PlanSummary, usePlans, usePlanSummary } from "@/lib/api/plans";
import { usePlanCommands } from "@/lib/commands";
import {
  BAND_ENTRIES,
  isLauncherShortcut,
  KEYBOARD_NOTE,
  KEYBOARD_SHORTCUTS,
  LAUNCHER_ACTIONS,
  LAUNCHER_STEPS,
  type LauncherAction,
  type LauncherConfirm,
  type LauncherContext,
  type LauncherResult,
  type LauncherResultGroup,
  launcherResults,
  type LauncherStep,
  NO_MATCH,
  type PlanRef,
  SEARCH_PLACEHOLDER,
  STAGE2_ENTRIES,
  STEP_DONE,
  stepCountLines,
  stepState,
  type StepStateText,
  YOU_ARE_HERE,
} from "@/lib/launcher";
import { cn } from "@/lib/utils";
import { type StepKey, stepFromSegment } from "@/lib/view-state/steps";
import { parsePlanPath, planOpenHref, planStepHref } from "@/lib/view-state/urls";

export const LAUNCHER_LABEL = "Launcher";
export const OPEN_LAUNCHER_LABEL = "Open the launcher";

/** An action worded for the open plan (label, disabled reason) with what it needs to run. */
export type ResolvedAction = {
  id: string;
  column: StepKey;
  label: string;
  keywords?: readonly string[];
  disabledReason?: string;
  action: LauncherAction;
};

export function resolveActions(actions: readonly LauncherAction[], ctx: LauncherContext): ResolvedAction[] {
  return actions.map((action) => ({
    id: action.id,
    column: action.column,
    label: action.label(ctx),
    keywords: action.keywords,
    disabledReason: action.disabledReason?.(ctx),
    action,
  }));
}

export type LauncherResults = LauncherResultGroup<ResolvedAction>[] | null;
type Item = LauncherResult<ResolvedAction>;

/** A modal dialog other than the launcher is open: the shortcut is ignored then. */
function otherModalOpen(): boolean {
  return document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"]') !== null;
}

// ---------------------------------------------------------------------------------------------
// Roving groups: each column (and band group) is one tab stop; ↑/↓ move within it, no wrap.

type RovingItemProps = {
  "data-roving-index": number;
  tabIndex: number;
  onFocus: () => void;
};

function RovingGroup({
  label,
  count,
  className,
  children,
}: {
  label: string;
  /** How many roving items the group holds. */
  count: number;
  className?: string;
  children: (item: (index: number) => RovingItemProps) => ReactNode;
}) {
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const current = Math.min(active, Math.max(0, count - 1));

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = [...(ref.current?.querySelectorAll<HTMLElement>("[data-roving-index]") ?? [])];
    const at = items.findIndex((element) => element === document.activeElement);
    if (at < 0) return;
    event.preventDefault();
    const next = Math.min(items.length - 1, Math.max(0, at + (event.key === "ArrowDown" ? 1 : -1)));
    items[next]?.focus();
  }

  const item = (index: number): RovingItemProps => ({
    "data-roving-index": index,
    tabIndex: index === current ? 0 : -1,
    onFocus: () => setActive(index),
  });

  return (
    <div ref={ref} role="group" aria-label={label} onKeyDown={onKeyDown} className={className}>
      {children(item)}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// The drawer's body: the columns and band (blank query) or the grouped results.

export type LauncherBodyProps = {
  planId: string;
  currentStep?: StepKey;
  /** Undefined until the summary loads: then columns show links and states only. */
  summary?: PlanSummary;
  /** The other saved plans (the open plan excluded), in server order. */
  plans: readonly PlanRef[];
  actions: readonly ResolvedAction[];
  /** `launcherResults(...)`; null shows the columns. */
  results: LauncherResults;
  query: string;
  /** Index of the highlighted result (across all groups). */
  highlight: number;
  listboxId: string;
  optionId: (index: number) => string;
  onActivate: (item: Item) => void;
};

const ENTRY_LINK = "rounded outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2";

/** A plain left click activates the entry; a modified or middle click keeps the link's default (new tab). */
function preventAnd(run: () => void) {
  return (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    run();
  };
}

function StepDisc({ step, state }: { step: LauncherStep; state: StepStateText }) {
  if (state === STEP_DONE) {
    return (
      <span aria-hidden="true" className="relative z-10 grid size-[26px] place-items-center rounded-full bg-ink text-surface">
        <Icon name="check" size={14} />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative z-10 grid size-[26px] place-items-center rounded-full border-[1.5px] border-ink type-tag",
        state === YOU_ARE_HERE ? "bg-ink text-surface" : "bg-surface text-ink",
      )}
    >
      {step.number}
    </span>
  );
}

function ActionButton({
  action,
  item,
  onActivate,
}: {
  action: ResolvedAction;
  item: RovingItemProps;
  onActivate: () => void;
}) {
  const reasonId = useId();
  const disabled = action.disabledReason !== undefined;
  return (
    <span className="flex flex-col">
      <button
        type="button"
        {...item}
        aria-disabled={disabled ? "true" : undefined}
        aria-describedby={disabled ? reasonId : undefined}
        onClick={() => {
          if (!disabled) onActivate();
        }}
        className={cn(
          ENTRY_LINK,
          "self-start text-left type-button underline underline-offset-2",
          disabled ? "cursor-not-allowed text-ink-disabled" : "text-ink",
        )}
      >
        {action.label}
      </button>
      {disabled && (
        <span id={reasonId} className="type-caption text-ink-secondary">
          {action.disabledReason}
        </span>
      )}
    </span>
  );
}

function StepColumn({
  step,
  planId,
  currentStep,
  summary,
  actions,
  onActivate,
}: {
  step: LauncherStep;
  planId: string;
  currentStep?: StepKey;
  summary?: PlanSummary;
  actions: readonly ResolvedAction[];
  onActivate: (item: Item) => void;
}) {
  const state = stepState(step.key, currentStep, summary);
  const current = state === YOU_ARE_HERE;
  const own = summary ? actions.filter((action) => action.column === step.key) : [];
  const counts = summary ? stepCountLines(step.key, summary) : [];
  return (
    <RovingGroup
      label={step.name}
      count={1 + own.length}
      className={cn(
        "flex min-w-0 flex-col items-start gap-1 rounded px-2.5 pb-3",
        current && "bg-selected-tint ring-[1.5px] ring-ink ring-inset",
      )}
    >
      {(item) => (
        <>
          <span className="-mb-0.5 pt-0 pb-1">
            <StepDisc step={step} state={state} />
          </span>
          <Link
            href={planStepHref(planId, step.key)}
            {...item(0)}
            aria-current={current ? "step" : undefined}
            onClick={preventAnd(() => onActivate({ kind: "step", id: `step:${step.key}`, step }))}
            className={cn(ENTRY_LINK, "flex flex-col text-ink")}
          >
            <span className="type-plate-code">{step.code}</span>
            <span className="type-body-strong">{step.name}</span>
          </Link>
          {current ? (
            <span className="rounded-xs border-[1.5px] border-ink bg-surface px-1.5 py-0.5 text-ink type-tag">
              {YOU_ARE_HERE}
            </span>
          ) : (
            <span className="type-meta text-ink-secondary">{state}</span>
          )}
          {counts.map((line) => (
            <span key={line} className="type-meta text-ink">
              {line}
            </span>
          ))}
          {own.map((action, index) => (
            <ActionButton
              key={action.id}
              action={action}
              item={item(index + 1)}
              onActivate={() => onActivate({ kind: "action", id: `action:${action.id}`, action })}
            />
          ))}
        </>
      )}
    </RovingGroup>
  );
}

function PlansBand({
  planId,
  summary,
  plans,
  onActivate,
}: {
  planId: string;
  summary?: PlanSummary;
  plans: readonly PlanRef[];
  onActivate: (item: Item) => void;
}) {
  const recent = plans.slice(0, RECENT_PLANS_MAX);
  return (
    <RovingGroup
      label="Plans"
      count={recent.length + BAND_ENTRIES.length}
      className="flex min-w-0 flex-col gap-2 rounded-xl border border-border p-3"
    >
      {(item) => (
        <>
          <h3 className="type-column-head text-ink-secondary">Plans</h3>
          {summary && (
            <div className="flex flex-col rounded border-l-[6px] border-ink bg-ground px-3 py-1.5">
              <span className="truncate type-body-strong text-ink">{summary.name}</span>
              <span className="type-meta text-ink-secondary">{plateMeta(summary.data_as_of, summary.current_round)}</span>
            </div>
          )}
          {recent.length > 0 && (
            <ul className="flex flex-col gap-1">
              {recent.map((plan, index) => (
                <li key={plan.id}>
                  <Link
                    href={planOpenHref(plan.id)}
                    {...item(index)}
                    onClick={preventAnd(() => onActivate({ kind: "plan", id: `plan:${plan.id}`, plan }))}
                    className={cn(ENTRY_LINK, "block truncate type-button text-ink underline underline-offset-2")}
                  >
                    {plan.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <ul className="flex flex-wrap gap-2">
            {BAND_ENTRIES.map((entry, index) => (
              <li key={entry.id}>
                <Link
                  href={entry.href(planId)}
                  {...item(recent.length + index)}
                  onClick={preventAnd(() => onActivate({ kind: "band", id: `band:${entry.id}`, entry }))}
                  className={cn(ENTRY_LINK, "flex w-44 flex-col rounded border border-border bg-surface px-2.5 py-1.5 text-ink")}
                >
                  <span className="type-code">{entry.code}</span>
                  <span className="type-body-strong">{entry.name}</span>
                  <span className="type-caption text-ink-secondary">{entry.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </RovingGroup>
  );
}

function Stage2Band({ planId, onActivate }: { planId: string; onActivate: (item: Item) => void }) {
  return (
    <RovingGroup label="Stage 2" count={STAGE2_ENTRIES.length} className="flex flex-col gap-2">
      {(item) => (
        <>
          {STAGE2_ENTRIES.map((entry, index) => (
            <Link
              key={entry.id}
              href={entry.href(planId)}
              {...item(index)}
              onClick={preventAnd(() => onActivate({ kind: "band", id: `band:${entry.id}`, entry }))}
              className={cn(
                ENTRY_LINK,
                "flex w-52 flex-col items-start rounded border-[1.4px] border-border bg-surface px-3 py-2 text-left text-ink",
              )}
            >
              <span className="font-code text-[34px] leading-none font-bold">{entry.code}</span>
              <span className="type-body-strong">{entry.name}</span>
              <span className="type-caption text-ink-secondary">{entry.description}</span>
            </Link>
          ))}
        </>
      )}
    </RovingGroup>
  );
}

function KeyboardBox() {
  return (
    <section aria-label="Keyboard" className="flex flex-col gap-1 rounded-xl border border-border p-3">
      <h3 className="type-column-head text-ink-secondary">Keyboard</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {KEYBOARD_SHORTCUTS.map((shortcut) => (
          <div key={shortcut.keys} className="contents">
            <dt>
              <kbd className="rounded-xs border border-border bg-ground px-1 type-tag text-ink">{shortcut.keys}</kbd>
            </dt>
            <dd className="type-meta text-ink">{shortcut.label}</dd>
          </div>
        ))}
      </dl>
      <p className="type-caption text-ink-secondary">{KEYBOARD_NOTE}</p>
    </section>
  );
}

function itemLabel(item: Item): { code?: string; name: string; description?: string; disabled: boolean } {
  switch (item.kind) {
    case "step":
      return { code: item.step.code, name: item.step.name, disabled: false };
    case "action":
      return {
        name: item.action.label,
        description: item.action.disabledReason,
        disabled: item.action.disabledReason !== undefined,
      };
    case "band":
      return { code: item.entry.code, name: item.entry.name, description: item.entry.description, disabled: false };
    case "plan":
      return { name: item.plan.name, disabled: false };
  }
}

function ResultsList({
  results,
  query,
  highlight,
  listboxId,
  optionId,
  onActivate,
}: Pick<LauncherBodyProps, "query" | "highlight" | "listboxId" | "optionId" | "onActivate"> & {
  results: LauncherResultGroup<ResolvedAction>[];
}) {
  const headId = useId();
  if (results.length === 0) {
    return (
      <p role="status" className="px-2 py-3 type-body text-ink">
        {NO_MATCH(query)}
      </p>
    );
  }
  // Each group's first option index in the flat list the highlight moves through.
  const starts = results.map((_, at) => results.slice(0, at).reduce((sum, group) => sum + group.items.length, 0));
  return (
    <div id={listboxId} role="listbox" aria-label="Results" className="flex flex-col gap-3">
      {results.map((group, groupIndex) => (
        <div key={group.label} role="group" aria-labelledby={`${headId}-${groupIndex}`} className="flex flex-col gap-0.5">
          <div id={`${headId}-${groupIndex}`} role="presentation" className="px-2 type-column-head text-ink-secondary">
            {group.label}
          </div>
          {group.items.map((item, itemIndex) => {
            const at = starts[groupIndex] + itemIndex;
            const label = itemLabel(item);
            const selected = at === highlight;
            return (
              <div
                key={item.id}
                id={optionId(at)}
                role="option"
                aria-selected={selected}
                aria-disabled={label.disabled ? "true" : undefined}
                // Keep focus in the search field while an option is clicked.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (!label.disabled) onActivate(item);
                }}
                className={cn(
                  "flex min-h-control-md cursor-pointer items-baseline gap-2 border-l-[3px] px-2 py-1",
                  selected ? "border-ink bg-selected-tint" : "border-transparent",
                  label.disabled && "cursor-not-allowed text-ink-disabled",
                )}
              >
                {label.code && <span className="w-10 shrink-0 type-code">{label.code}</span>}
                <span className="type-body-strong">{label.name}</span>
                {label.description && <span className="min-w-0 truncate type-caption text-ink-secondary">{label.description}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** The drawer's contents below the search field (no data fetching; rendered in tests too). */
export function LauncherBody({
  planId,
  currentStep,
  summary,
  plans,
  actions,
  results,
  query,
  highlight,
  listboxId,
  optionId,
  onActivate,
}: LauncherBodyProps) {
  if (results !== null) {
    return (
      <ResultsList
        results={results}
        query={query}
        highlight={highlight}
        listboxId={listboxId}
        optionId={optionId}
        onActivate={onActivate}
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        {/* The track the step discs sit on. */}
        <span
          aria-hidden="true"
          className="absolute top-[12px] right-4 left-4 hidden h-0.5 bg-launcher-rail xl:block"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {LAUNCHER_STEPS.map((step) => (
            <StepColumn
              key={step.key}
              step={step}
              planId={planId}
              currentStep={currentStep}
              summary={summary}
              actions={actions}
              onActivate={onActivate}
            />
          ))}
        </div>
      </div>
      <div className="grid gap-3 border-t border-hairline pt-4 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
        <PlansBand planId={planId} summary={summary} plans={plans} onActivate={onActivate} />
        <Stage2Band planId={planId} onActivate={onActivate} />
        <KeyboardBox />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// The button, the shortcut, the dialog and the confirm.

function hrefOf(item: Item, planId: string): string | undefined {
  switch (item.kind) {
    case "step":
      return planStepHref(planId, item.step.key);
    case "plan":
      return planOpenHref(item.plan.id);
    case "band":
      return item.entry.href(planId);
    case "action":
      return undefined;
  }
}

type PendingConfirm = { confirm: LauncherConfirm; run: () => void };

function PlanLauncher({
  planId,
  currentStep,
  actions,
}: {
  planId: string;
  currentStep?: StepKey;
  actions: readonly LauncherAction[];
}) {
  const router = useRouter();
  const summary = usePlanSummary(planId).data;
  const plans = usePlans().data;
  const { sendWithEvents, disabledReason } = usePlanCommands(planId);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [top, setTop] = useState(64);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const isOpen = useRef(false);
  // What to do once the drawer has closed (and focus is back on the grid button).
  const pending = useRef<(() => void) | null>(null);
  const listboxId = useId();
  const optionPrefix = useId();
  const optionId = useCallback((index: number) => `${optionPrefix}-${index}`, [optionPrefix]);

  const ctx = useMemo<LauncherContext | undefined>(
    () =>
      summary && {
        planId,
        summary,
        savingReason: disabledReason,
        navigate: (href) => router.push(href),
        send: sendWithEvents,
        notify: (text) => {
          showToast(text);
        },
      },
    [planId, summary, disabledReason, router, sendWithEvents],
  );
  const resolved = useMemo(() => (ctx ? resolveActions(actions, ctx) : []), [actions, ctx]);
  const otherPlans = useMemo(
    () => (plans ?? []).filter((plan) => plan.id !== planId).map((plan) => ({ id: plan.id, name: plan.name })),
    [plans, planId],
  );
  const results = launcherResults(query, { actions: resolved, plans: otherPlans });
  const flat = results?.flatMap((group) => group.items) ?? [];
  const highlighted = Math.min(highlight, flat.length - 1);

  // The toolbar header, kept from opening: on unmount `button.current` is already null.
  const headerRef = useRef<HTMLElement | null>(null);
  const header = useCallback(() => {
    headerRef.current = button.current?.closest("header") ?? headerRef.current;
    return headerRef.current;
  }, []);

  const setBackgroundInert = useCallback((inert: boolean) => {
    const elements = [document.getElementById("content"), inert ? header() : headerRef.current];
    for (const element of elements) element?.toggleAttribute("inert", inert);
  }, [header]);

  const openDrawer = useCallback(() => {
    setTop(Math.max(0, header()?.getBoundingClientRect().bottom ?? 64));
    setQuery("");
    setHighlight(0);
    setOpen(true);
  }, [header]);

  // Keep the highlighted result visible in the scrolling drawer.
  const highlightedId = results !== null && highlighted >= 0 ? optionId(highlighted) : undefined;
  useEffect(() => {
    if (highlightedId) document.getElementById(highlightedId)?.scrollIntoView({ block: "nearest" });
  }, [highlightedId]);

  useEffect(() => {
    isOpen.current = open;
    if (open) setBackgroundInert(true);
  }, [open, setBackgroundInert]);

  // The page behind never stays inert once the launcher is gone.
  useEffect(() => () => setBackgroundInert(false), [setBackgroundInert]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isLauncherShortcut(event)) return;
      if (isOpen.current) {
        event.preventDefault();
        search.current?.focus();
        return;
      }
      // Another modal keeps the focus: no launcher, and no browser search bar either.
      if (otherModalOpen()) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      openDrawer();
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [openDrawer]);

  function closeThen(next: () => void) {
    pending.current = next;
    setOpen(false);
  }

  function activate(item: Item) {
    if (item.kind === "action") {
      const { action, disabledReason: reason } = item.action;
      if (reason !== undefined || !ctx) return;
      const ask = action.confirm?.(ctx);
      if (ask) {
        closeThen(() => {
          setConfirm({ confirm: ask, run: () => void action.run(ctx) });
          setConfirmOpen(true);
        });
      } else {
        closeThen(() => void action.run(ctx));
      }
      return;
    }
    const href = hrefOf(item, planId);
    if (href) closeThen(() => router.push(href));
  }

  function onSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
    setHighlight(0);
  }

  function onSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (results === null || event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (flat.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlight(Math.min(flat.length - 1, Math.max(0, highlighted + step)));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = flat[highlighted];
      if (item) activate(item);
    }
  }

  return (
    <>
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (next) openDrawer();
          else setOpen(false);
        }}
      >
        <Dialog.Trigger asChild>
          <button
            ref={button}
            type="button"
            aria-label={OPEN_LAUNCHER_LABEL}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-keyshortcuts="Control+K Meta+K"
            data-pressed={open ? "true" : undefined}
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-lg border border-flow-track-edge",
              open ? "bg-surface text-ink" : "bg-flow-track text-on-dark-nav",
            )}
          >
            <Icon name="grid" size={18} />
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay
            style={{ top }}
            className="fixed inset-x-0 bottom-0 z-50 bg-ink/45 data-[state=open]:animate-in data-[state=open]:fade-in-0"
          />
          <Dialog.Content
            aria-modal="true"
            aria-describedby={undefined}
            style={{ top, maxHeight: `calc(100dvh - ${top}px)` }}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              search.current?.focus();
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              setBackgroundInert(false);
              button.current?.focus();
              const next = pending.current;
              pending.current = null;
              next?.();
            }}
            className="fixed inset-x-0 z-50 overflow-y-auto border-b border-border bg-surface px-page-gutter py-4 text-ink shadow-overlay"
          >
            <Dialog.Title className="sr-only">{LAUNCHER_LABEL}</Dialog.Title>
            <div className="mx-auto flex max-w-[1440px] flex-col gap-4">
              <div className="relative max-w-[560px]">
                <Icon
                  name="search"
                  size={16}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-secondary"
                />
                <input
                  ref={search}
                  type="text"
                  role="combobox"
                  aria-label={SEARCH_PLACEHOLDER}
                  aria-autocomplete="list"
                  aria-expanded={results !== null && flat.length > 0}
                  aria-controls={results !== null && flat.length > 0 ? listboxId : undefined}
                  aria-activedescendant={highlightedId}
                  placeholder={SEARCH_PLACEHOLDER}
                  autoComplete="off"
                  spellCheck={false}
                  value={query}
                  onChange={onSearchChange}
                  onKeyDown={onSearchKeyDown}
                  className="h-control-lg w-full min-w-0 rounded-lg border border-input-border bg-surface pr-3 pl-9 text-ink type-body placeholder:text-ink-muted"
                />
              </div>
              <LauncherBody
                planId={planId}
                currentStep={currentStep}
                summary={summary}
                plans={otherPlans}
                actions={resolved}
                results={results}
                query={query}
                highlight={highlighted}
                listboxId={listboxId}
                optionId={optionId}
                onActivate={activate}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {confirm && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={confirm.confirm.title}
          description={confirm.confirm.description}
          confirmLabel={confirm.confirm.confirmLabel}
          destructive={confirm.confirm.destructive}
          onConfirm={confirm.run}
          // The confirm has no trigger of its own: focus goes back to the grid button.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            button.current?.focus();
          }}
        />
      )}
    </>
  );
}

/** The toolbar's launcher on a plan path; nothing elsewhere. */
export function Launcher({ actions = LAUNCHER_ACTIONS }: { actions?: readonly LauncherAction[] }) {
  const planPath = parsePlanPath(usePathname() ?? "");
  if (!planPath) return null;
  return (
    <PlanLauncher
      key={planPath.planId}
      planId={planPath.planId}
      currentStep={stepFromSegment(planPath.view)}
      actions={actions}
    />
  );
}


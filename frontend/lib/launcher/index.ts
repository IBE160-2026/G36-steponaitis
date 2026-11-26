// Launcher data (UX-DR7, UX-DR8, UJ-8, Story 6.5): everything the flow map drawer lists that is not
// a flow step, as plain data, plus the pure helpers that word its states and counts and match its
// search. The drawer (modules/launcher) only renders these lists, so a later epic adds an action
// (Undo last move, Reset… in Epic 7) by appending it to `LAUNCHER_ACTIONS`, without touching the
// launcher's code. Counts come from the plan summary only (AD-3).

import type { CommandEvent, PlanSummary } from "@/lib/api/plans";
import type { CommandBody, SendResult } from "@/lib/commands/client";
import { sendReset } from "@/lib/commands/reset";
import { sendUndo, undoReason } from "@/lib/commands/undo";
import {
  applyAllQuestion,
  applyAllToast,
  NO_OPEN_TO_APPLY,
  RESET_CONFIRM,
  RESET_ITEM,
  RESET_TITLE,
  resetQuestion,
  runAnnouncement,
  UNDO_LAST_MOVE,
  undoLabel,
} from "@/lib/copy";
import { formatDate, formatNumber } from "@/lib/format";
import { FLOW_STEPS, type StepKey } from "@/lib/view-state/steps";
import {
  NEW_PLAN_HREF,
  newPlanFromHref,
  planCategoriesHref,
  planLabelsHref,
  planSettingsHref,
  planStepHref,
  SAVED_PLANS_HREF,
} from "@/lib/view-state/urls";

/** The plate code of each flow step (UX-DR7). */
export const STEP_CODES: Record<StepKey, string> = {
  overview: "OVR",
  parts: "PRT",
  locations: "LOC",
  "pick-groups": "GRP",
  "best-locations": "BST",
  recommendations: "REC",
  "before-after": "B/A",
  "move-list": "MOV",
};

export type LauncherStep = { key: StepKey; number: number; name: string; code: string };

/** The eight flow steps with their codes, in flow order. */
export const LAUNCHER_STEPS: readonly LauncherStep[] = FLOW_STEPS.map((step) => ({
  key: step.key,
  number: step.number,
  name: step.name,
  code: STEP_CODES[step.key],
}));

/** What an action gets to work with: the open plan, its summary and the app's effects. */
export type LauncherContext = {
  planId: string;
  summary: PlanSummary;
  /** Set while a command is pending (`SAVING_REASON`); plan-changing actions are disabled then. */
  savingReason?: string;
  navigate: (href: string) => void;
  send: (body: CommandBody) => Promise<SendResult>;
  notify: (text: string) => void;
};

export type LauncherConfirm = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
};

/** A registered action: listed in its step's column and found by search. */
export type LauncherAction = {
  id: string;
  /** The step whose column lists the action. */
  column: StepKey;
  label: (ctx: LauncherContext) => string;
  /** Extra search words besides the label. */
  keywords?: readonly string[];
  /** Why the action cannot run now; undefined when it can. */
  disabledReason?: (ctx: LauncherContext) => string | undefined;
  /** When given, the shared ConfirmDialog asks first and `run` happens only on confirm. */
  confirm?: (ctx: LauncherContext) => LauncherConfirm;
  run: (ctx: LauncherContext) => void | Promise<void>;
};

function findEvent<T extends CommandEvent["type"]>(events: readonly CommandEvent[], type: T) {
  return events.find((event): event is Extract<CommandEvent, { type: T }> => event.type === type);
}

/** Run recommendations (FR-23): the next round, on the Recommendations step. */
const RUN_RECOMMENDATIONS: LauncherAction = {
  id: "run-recommendations",
  column: "recommendations",
  label: (ctx) => `Run round ${formatNumber(ctx.summary.current_round + 1)}`,
  keywords: ["run recommendations"],
  disabledReason: (ctx) => ctx.savingReason,
  async run(ctx) {
    ctx.navigate(planStepHref(ctx.planId, "recommendations"));
    const result = await ctx.send({ type: "run" });
    if (result.outcome !== "confirmed") return;
    const done = findEvent(result.events, "run_done");
    if (done) ctx.notify(runAnnouncement(done));
  },
};

/** Apply all (FR-30, UX-DR34): every open recommendation of the latest run, after a confirm. */
const APPLY_ALL: LauncherAction = {
  id: "apply-all",
  column: "recommendations",
  label: (ctx) => `Apply all (${formatNumber(ctx.summary.apply_all_count)})…`,
  disabledReason: (ctx) => (ctx.summary.apply_all_count === 0 ? NO_OPEN_TO_APPLY : ctx.savingReason),
  confirm: (ctx) => ({
    title: "Apply all",
    description: applyAllQuestion(ctx.summary.apply_all_count, ctx.summary.current_round),
    confirmLabel: "Apply all",
    destructive: false,
  }),
  async run(ctx) {
    const round = ctx.summary.current_round;
    ctx.navigate(planStepHref(ctx.planId, "recommendations"));
    const result = await ctx.send({ type: "apply_all" });
    if (result.outcome !== "confirmed") return;
    const done = findEvent(result.events, "apply_all_done");
    if (done) ctx.notify(applyAllToast(done, round));
  },
};

/** Undo last move (FR-35, UX-DR38): the server's `undo_preview` worded, or "Undo last move" with nothing to undo. */
export const UNDO_LAST_MOVE_ACTION: LauncherAction = {
  id: "undo-last-move",
  column: "recommendations",
  label: (ctx) => (ctx.summary.undo_preview === null ? UNDO_LAST_MOVE : undoLabel(ctx.summary.undo_preview)),
  keywords: ["undo last move"],
  disabledReason: (ctx) => undoReason(ctx.summary.undo_preview, ctx.savingReason),
  async run(ctx) {
    const preview = ctx.summary.undo_preview;
    if (preview === null) return;
    await sendUndo(ctx.send, preview.move_number, ctx.notify);
  },
};

/** Reset… (FR-35, UX-DR38): delete every move and run after a destructive confirm; marks stay. */
export const RESET_ACTION: LauncherAction = {
  id: "reset",
  column: "recommendations",
  label: () => RESET_ITEM,
  keywords: ["reset plan"],
  disabledReason: (ctx) => ctx.savingReason,
  confirm: (ctx) => ({
    title: RESET_TITLE,
    description: resetQuestion(ctx.summary.move_count),
    confirmLabel: RESET_CONFIRM,
    destructive: true,
  }),
  async run(ctx) {
    ctx.navigate(planStepHref(ctx.planId, "recommendations"));
    await sendReset(ctx.send, ctx.notify);
  },
};

/** The registered actions, in list order. Append here to add one; the launcher needs no change. */
export const LAUNCHER_ACTIONS: readonly LauncherAction[] = [
  RUN_RECOMMENDATIONS,
  APPLY_ALL,
  UNDO_LAST_MOVE_ACTION,
  RESET_ACTION,
];

/** A plan-level entry of the band (SAV, NEW, SET, and the stage-2 CAT). */
export type BandEntry = {
  id: string;
  code: string;
  name: string;
  description: string;
  /** Extra search words besides the code and name. */
  keywords?: readonly string[];
  href: (planId: string) => string;
};

export const BAND_ENTRIES: readonly BandEntry[] = [
  {
    id: "saved-plans",
    code: "SAV",
    name: "Saved plans",
    description: "Every saved plan, most recently edited first",
    href: () => SAVED_PLANS_HREF,
  },
  {
    id: "new-plan",
    code: "NEW",
    name: "New Plan",
    description: "Start a plan from the three export files",
    href: () => NEW_PLAN_HREF,
  },
  {
    id: "new-plan-from-import",
    code: "NEW",
    name: "New Plan from this import",
    description: "A new plan on this plan's import",
    href: (planId) => newPlanFromHref(planId),
  },
  {
    id: "settings",
    code: "SET",
    name: "Settings",
    description: "This plan's analysis settings",
    href: (planId) => planSettingsHref(planId),
  },
];

/** CAT (Story 13.2, UX-DR7): the first active stage-2 plate; it opens the Categories page. */
export const CATEGORIES_ENTRY: BandEntry = {
  id: "categories",
  code: "CAT",
  name: "Categories",
  description: "Keyword rules and aisle categories",
  keywords: ["category check", "keyword rules", "aisle categories"],
  href: (planId) => planCategoriesHref(planId),
};

/** LBL (Story 14.1, FR-48): the second stage-2 plate; it opens the location labels print view. */
export const LABELS_ENTRY: BandEntry = {
  id: "labels",
  code: "LBL",
  name: "Location labels",
  description: "Print a QR label for every location in an aisle",
  keywords: ["labels", "qr"],
  href: (planId) => planLabelsHref(planId),
};

/** The stage-2 plates, in band order: CAT, then LBL. */
export const STAGE2_ENTRIES: readonly BandEntry[] = [CATEGORIES_ENTRY, LABELS_ENTRY];

/** Every band entry search finds, listed under Actions: the Plans band's, then CAT and LBL. */
export const SEARCH_BAND_ENTRIES: readonly BandEntry[] = [...BAND_ENTRIES, ...STAGE2_ENTRIES];

/** The Keyboard box. */
export const KEYBOARD_SHORTCUTS = [
  { keys: "Ctrl K", label: "Open this menu" },
  { keys: "Ctrl /", label: "Search the page" },
  { keys: "Alt A", label: "Apply" },
  { keys: "Esc", label: "Close" },
] as const;

export const KEYBOARD_NOTE = "⌘ and ⌥ on a Mac.";

export const SEARCH_PLACEHOLDER = "Search features, actions and plans";

/** `No feature or saved plan matches “xyz”.` with the trimmed query in curly quotes. */
export function NO_MATCH(query: string): string {
  return `No feature or saved plan matches “${query.trim()}”.`;
}

export const YOU_ARE_HERE = "You are here";
export const STEP_OUTPUT = "Output";
export const STEP_DONE = "Done";
export const STEP_NOT_DONE = "Not done yet";

export type StepStateText = typeof YOU_ARE_HERE | typeof STEP_OUTPUT | typeof STEP_DONE | typeof STEP_NOT_DONE;

/** A column's state line; without a summary, a step that is not current or output is "Not done yet". */
export function stepState(step: StepKey, currentStep: StepKey | undefined, summary?: PlanSummary): StepStateText {
  if (step === currentStep) return YOU_ARE_HERE;
  if (step === "before-after" || step === "move-list") return STEP_OUTPUT;
  if (summary?.steps.find((candidate) => candidate.key === step)?.checked) return STEP_DONE;
  return STEP_NOT_DONE;
}

function stepCount(summary: PlanSummary, step: StepKey): number | null {
  return summary.steps.find((candidate) => candidate.key === step)?.count ?? null;
}

/** A column's live counts, from the plan summary only (AD-3). */
export function stepCountLines(step: StepKey, summary: PlanSummary): string[] {
  const counted = (text: string) => {
    const count = stepCount(summary, step);
    return count === null ? [] : [`${formatNumber(count)} ${text}`];
  };
  switch (step) {
    case "overview":
      return [`Data as of ${formatDate(summary.data_as_of)}`, `round ${formatNumber(summary.current_round)}`];
    case "parts":
      return [...counted("parts"), `${formatNumber(summary.class_counts.fast)} fast-moving`];
    case "locations":
      return counted("locations");
    case "pick-groups":
      return counted("pick groups");
    case "best-locations":
      return [`${formatNumber(summary.best_locations)} best · ${formatNumber(summary.empty_best_locations)} empty`];
    case "recommendations":
      return [`Round ${formatNumber(summary.current_round)} · ${formatNumber(summary.apply_all_count)} to apply`];
    case "before-after":
    case "move-list":
      return [];
  }
}

/** What search matches of an action: its label (already worded for the plan) and keywords. */
export type SearchableAction = { id: string; label: string; keywords?: readonly string[] };
export type PlanRef = { id: string; name: string };

export type LauncherResult<A extends SearchableAction = SearchableAction> =
  | { kind: "step"; id: string; step: LauncherStep }
  | { kind: "action"; id: string; action: A }
  | { kind: "band"; id: string; entry: BandEntry }
  | { kind: "plan"; id: string; plan: PlanRef };

export type LauncherResultGroup<A extends SearchableAction = SearchableAction> = {
  label: "Steps" | "Actions" | "Saved plans";
  items: LauncherResult<A>[];
};

/**
 * Search results, grouped Steps / Actions / Saved plans with empty groups dropped. The trimmed
 * query matches case-insensitively as a substring of a step's code or name, an action's label or
 * keywords, a band entry's code, name or keywords (listed under Actions) or a plan's name. Items keep list
 * order. A blank query gives null (the columns show).
 */
export function launcherResults<A extends SearchableAction>(
  query: string,
  {
    steps = LAUNCHER_STEPS,
    actions,
    band = SEARCH_BAND_ENTRIES,
    plans,
  }: {
    steps?: readonly LauncherStep[];
    actions: readonly A[];
    band?: readonly BandEntry[];
    plans: readonly PlanRef[];
  },
): LauncherResultGroup<A>[] | null {
  const needle = query.trim().toLowerCase();
  if (needle === "") return null;
  const matches = (...texts: readonly string[]) => texts.some((text) => text.toLowerCase().includes(needle));
  const groups: LauncherResultGroup<A>[] = [
    {
      label: "Steps",
      items: steps
        .filter((step) => matches(step.code, step.name))
        .map((step) => ({ kind: "step", id: `step:${step.key}`, step })),
    },
    {
      label: "Actions",
      items: [
        ...actions
          .filter((action) => matches(action.label, ...(action.keywords ?? [])))
          .map((action): LauncherResult<A> => ({ kind: "action", id: `action:${action.id}`, action })),
        ...band
          .filter((entry) => matches(entry.code, entry.name, ...(entry.keywords ?? [])))
          .map((entry): LauncherResult<A> => ({ kind: "band", id: `band:${entry.id}`, entry })),
      ],
    },
    {
      label: "Saved plans",
      items: plans.filter((plan) => matches(plan.name)).map((plan) => ({ kind: "plan", id: `plan:${plan.id}`, plan })),
    },
  ];
  return groups.filter((group) => group.items.length > 0);
}

type ShortcutEvent = Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">;

/**
 * `Ctrl+K` or `⌘K` opens the launcher: the K key by position (any layout, e.g. Cyrillic) or by
 * character, with no Alt and no Shift (`Ctrl+Shift+K` stays the browser's).
 */
export function isLauncherShortcut(event: ShortcutEvent): boolean {
  const k = event.code === "KeyK" || event.key === "k" || event.key === "K";
  return k && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
}

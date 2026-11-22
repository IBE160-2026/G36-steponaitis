import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { UndoLastMove } from "@/components/common/undo-last-move";
import type { CommandEvent, PlanSummary, UndoPreview } from "@/lib/api/plans";
import { type CommandBody, SAVING_REASON, type SendResult } from "@/lib/commands";
import { moveUndoAction, sendUndo, undoToastText } from "@/lib/commands/undo";
import { LAUNCHER_ACTIONS, type LauncherContext, UNDO_LAST_MOVE_ACTION } from "@/lib/launcher";

// Story 7.3 (FR-35, UX-DR38, UX-DR14): Undo last move in the header, the part panel and the
// launcher, and the Undo action of a move toast. Vitest has no DOM: the control is rendered to
// static markup and its click handler is called from the element's props.

const PREVIEW: UndoPreview = {
  move_number: 11,
  part: "1200",
  from_location: "B-01-01-02",
  to_location: "A-01-01-01",
  effect: { kind: "reverts_move", move_number: 11 },
};
const LABEL = "Undo move 11: 1200 B-01-01-02 → A-01-01-01";

const UNDONE: CommandEvent[] = [
  { type: "step_undone", undone: PREVIEW },
  { type: "recommendations_outdated", count: 4, cause: "undo" },
];
const TOAST = "Undid move 11. Unapplied recommendations of round 2 are now outdated. Run recommendations to continue.";

function sender(events: CommandEvent[] = UNDONE) {
  const sent: CommandBody[] = [];
  const send = vi.fn(async (body: CommandBody): Promise<SendResult> => {
    sent.push(body);
    return { outcome: "confirmed", events };
  });
  return { send, sent };
}

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

type ButtonProps = { onClick: () => void; disabledReason?: string; description?: string };

function control(preview: UndoPreview | null, savingReason?: string) {
  const { send, sent } = sender();
  const notify = vi.fn();
  const props = { preview, round: 2, savingReason, send, notify };
  const element = UndoLastMove(props) as ReactElement<ButtonProps>;
  return { element, markup: renderToStaticMarkup(<UndoLastMove {...props} />), sent, notify };
}

describe("fr35 undo last move control", () => {
  it("uxdr38_disabled_with_no_moves_to_undo", () => {
    const { element, markup } = control(null);
    expect(markup).toContain('aria-disabled="true"');
    expect(text(markup)).toContain("Undo last move");
    expect(text(markup)).toContain("No moves to undo");
    expect(element.props.disabledReason).toBe("No moves to undo");
  });

  it("uxdr38_disabled_while_saving", () => {
    const { element } = control(PREVIEW, SAVING_REASON);
    expect(element.props.disabledReason).toBe(SAVING_REASON);
  });

  it("uxdr38_names_the_move_in_tooltip_and_description", () => {
    const { element, markup } = control(PREVIEW);
    expect(markup).not.toContain("aria-disabled");
    expect(markup).toContain('role="tooltip"');
    expect(markup).toContain("aria-describedby");
    expect(text(markup)).toContain(LABEL);
    expect(element.props.description).toBe(LABEL);
  });

  it("fr35_click_sends_undo_with_the_preview_number_and_toasts", async () => {
    const { element, sent, notify } = control(PREVIEW);
    element.props.onClick();
    await vi.waitFor(() => expect(notify).toHaveBeenCalled());
    expect(sent).toEqual([{ type: "undo", expected_move_number: 11 }]);
    expect(notify).toHaveBeenCalledWith(TOAST);
  });

  it("uxdr38_toast_without_outdated", () => {
    expect(undoToastText([UNDONE[0]], 2)).toBe("Undid move 11.");
    expect(undoToastText([], 2)).toBeUndefined();
  });

  it("fr35_send_undo_does_not_toast_when_rejected", async () => {
    const send = vi.fn(async (): Promise<SendResult> => ({ outcome: "dropped", events: [] }));
    const notify = vi.fn();
    await sendUndo(send, 3, 1, notify);
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("uxdr14 move toast undo", () => {
  it("uxdr14_move_toast_undo_sends_that_move_number", async () => {
    const cases: [CommandEvent, number][] = [
      [
        {
          type: "move_made",
          move_number: 3,
          part: "1100",
          from_location: "C-01-01-01",
          to_location: "A-01-01-03",
          rule: "rule_1",
          round: 1,
        },
        3,
      ],
      [
        {
          type: "moves_combined",
          move_number: 3,
          part: "0100",
          from_location: "A-01-01-01",
          to_location: "B-01-03-02",
          round: 1,
          step_move_number: 5,
        },
        5,
      ],
      [
        { type: "move_removed", move_number: 3, part: "0100", location: "A-01-01-01", round: 1, step_move_number: 6 },
        6,
      ],
    ];
    for (const [event, number] of cases) {
      const { send, sent } = sender();
      const notify = vi.fn();
      const action = moveUndoAction(event, send, notify);
      expect(action?.label).toBe("Undo");
      action?.onClick();
      await vi.waitFor(() => expect(notify).toHaveBeenCalled());
      expect(sent).toEqual([{ type: "undo", expected_move_number: number }]);
    }
  });

  it("uxdr14_no_undo_for_mark_keep_run_or_apply_all", () => {
    const { send } = sender();
    const events: CommandEvent[] = [
      { type: "mark_set", mark: { kind: "aisle", aisle: "A" } },
      { type: "keep_set", part: "0500" },
      { type: "run_done", round: 1, recommendations: 13, no_space: 4 },
      { type: "apply_all_done", applied: [1, 2], skipped: [] },
    ];
    for (const event of events) expect(moveUndoAction(event, send, vi.fn())).toBeUndefined();
  });
});

function context(preview: UndoPreview | null, fields: Partial<LauncherContext> = {}): LauncherContext {
  const { send } = sender();
  return {
    planId: "11111111-1111-4111-8111-111111111111",
    summary: { current_round: 2, apply_all_count: 0, undo_preview: preview } as PlanSummary,
    navigate: vi.fn(),
    send,
    notify: vi.fn(),
    ...fields,
  };
}

describe("fr35 launcher undo last move", () => {
  it("uxdr38_launcher_action_registered_in_recommendations", () => {
    expect(LAUNCHER_ACTIONS).toContain(UNDO_LAST_MOVE_ACTION);
    expect(UNDO_LAST_MOVE_ACTION.column).toBe("recommendations");
    expect(UNDO_LAST_MOVE_ACTION.keywords).toEqual(["undo last move"]);
  });

  it("uxdr38_launcher_label_and_disabled_reason", () => {
    expect(UNDO_LAST_MOVE_ACTION.label(context(PREVIEW))).toBe(LABEL);
    expect(UNDO_LAST_MOVE_ACTION.label(context(null))).toBe("Undo last move");
    expect(UNDO_LAST_MOVE_ACTION.disabledReason?.(context(null))).toBe("No moves to undo");
    expect(UNDO_LAST_MOVE_ACTION.disabledReason?.(context(PREVIEW, { savingReason: SAVING_REASON }))).toBe(
      SAVING_REASON,
    );
    expect(UNDO_LAST_MOVE_ACTION.disabledReason?.(context(PREVIEW))).toBeUndefined();
  });

  it("fr35_launcher_sends_undo_and_notifies", async () => {
    const ctx = context(PREVIEW);
    await UNDO_LAST_MOVE_ACTION.run(ctx);
    expect(ctx.send).toHaveBeenCalledWith({ type: "undo", expected_move_number: 11 });
    expect(ctx.notify).toHaveBeenCalledWith(TOAST);
  });
});

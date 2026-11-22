import { DropdownMenu } from "radix-ui";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/common/button";
import { CONFIRM_BUTTON_ORDER, ConfirmDialog } from "@/components/common/confirm-dialog";
import type { CommandEvent } from "@/lib/api/plans";
import { SAVING_REASON, type SendResult } from "@/lib/commands";
import { sendReset } from "@/lib/commands/reset";
import { MORE_ACTIONS, RESET_ITEM, resetQuestion, resetToast } from "@/lib/copy";
import { ResetPlanMenuView, type ResetPlanMenuViewProps } from "@/modules/recommendations/reset-plan";

// Story 7.4 (FR-35, UX-DR38, UX-DR16): the Recommendations header's "⋯" menu, its Reset… confirm
// and the shared reset command flow. Vitest has no DOM, so the menu is walked as a plain tree and
// its handlers are called directly; keys and real focus are covered in e2e/reset.spec.ts.

type Element = ReactElement<Record<string, unknown>>;

function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}

function menu(fields: Partial<ResetPlanMenuViewProps> = {}) {
  const props: ResetPlanMenuViewProps = {
    moveCount: 18,
    savingReason: undefined,
    onConfirm: vi.fn(),
    dialogOpen: false,
    onDialogOpenChange: vi.fn(),
    trigger: { current: { focus: vi.fn() } as unknown as HTMLButtonElement },
    ...fields,
  };
  const tree = elements(ResetPlanMenuView(props));
  const item = tree.find((element) => element.type === DropdownMenu.Item)!;
  const dialog = tree.find((element) => element.type === ConfirmDialog)!;
  const trigger = tree.find((element) => element.type === Button)!;
  return { props, item, dialog, trigger };
}

function confirmed(events: CommandEvent[]) {
  return vi.fn(async (): Promise<SendResult> => ({ outcome: "confirmed", events }));
}

describe("fr35 reset menu", () => {
  it("uxdr38_more_actions_button_holds_reset", () => {
    const { item, trigger } = menu();
    expect(trigger.props["aria-label"]).toBe(MORE_ACTIONS);
    expect(item.props.children).toBe(RESET_ITEM);
    expect(item.props.disabled).toBe(false);
  });

  it("uxdr38_reset_item_disabled_while_saving_with_the_reason", () => {
    const { item } = menu({ savingReason: SAVING_REASON });
    expect(item.props.disabled).toBe(true);
    expect(item.props.title).toBe(SAVING_REASON);
  });

  it("uxdr38_uxdr16_reset_opens_the_destructive_confirm_with_the_exact_text", () => {
    const { item, props } = menu();
    (item.props.onSelect as () => void)();
    expect(props.onDialogOpenChange).toHaveBeenCalledWith(true);
    const { dialog } = menu({ dialogOpen: true });
    expect(dialog.props).toMatchObject({
      open: true,
      title: "Reset plan",
      description:
        "Reset removes all 18 moves, the recommendations and the no-space parts. Best-location marks and keep-in-place marks stay. The next run is round 1.",
      confirmLabel: "Reset plan",
      destructive: true,
    });
  });

  it("uxdr16_cancel_comes_first_and_has_the_focus", () => {
    const { dialog } = menu({ dialogOpen: true });
    expect(CONFIRM_BUTTON_ORDER[0]).toBe("cancel");
    const buttons = elements(ConfirmDialog(dialog.props as Parameters<typeof ConfirmDialog>[0])).filter(
      (element) => element.type === Button,
    );
    expect(buttons.map((button) => [button.props.children, button.props.variant])).toEqual([
      ["Cancel", "tertiary"],
      ["Reset plan", "destructive"],
    ]);
    // Radix AlertDialog focuses its Cancel (the first button) when it opens.
  });

  it("uxdr38_cancel_or_esc_sends_nothing_and_focuses_more_actions", () => {
    const { dialog, props } = menu({ dialogOpen: true });
    (dialog.props.onOpenChange as (open: boolean) => void)(false);
    const event = { preventDefault: vi.fn() };
    (dialog.props.onCloseAutoFocus as (event: unknown) => void)(event);
    expect(props.onDialogOpenChange).toHaveBeenCalledWith(false);
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(props.trigger.current?.focus).toHaveBeenCalled();
  });

  it("fr35_confirm_calls_on_confirm", () => {
    const { dialog, props } = menu({ dialogOpen: true });
    (dialog.props.onConfirm as () => void)();
    expect(props.onConfirm).toHaveBeenCalledOnce();
  });

  it("uxdr38_question_uses_the_server_move_count", () => {
    expect(menu({ moveCount: 1 }).dialog.props.description).toBe(resetQuestion(1));
    expect(menu({ moveCount: 0 }).dialog.props.description).toBe(resetQuestion(0));
  });
});

describe("fr35 reset command flow", () => {
  it("fr35_confirm_sends_reset_and_toasts_moves_removed", async () => {
    const send = confirmed([{ type: "plan_reset", moves_removed: 18 } as CommandEvent]);
    const notify = vi.fn();
    await sendReset(send, notify);
    expect(send).toHaveBeenCalledWith({ type: "reset" });
    expect(notify).toHaveBeenCalledWith(resetToast(18));
    expect(notify.mock.calls[0]).toHaveLength(1); // a reset toast never offers Undo
  });

  it("fr35_noop_reset_toasts_0_moves", async () => {
    const notify = vi.fn();
    await sendReset(confirmed([]), notify);
    expect(notify).toHaveBeenCalledWith("Plan reset. 0 moves removed; marks kept. The next run is round 1.");
  });

  it("fr35_dropped_reset_does_not_toast", async () => {
    const notify = vi.fn();
    await sendReset(
      vi.fn(async (): Promise<SendResult> => ({ outcome: "dropped", events: [] })),
      notify,
    );
    expect(notify).not.toHaveBeenCalled();
  });
});

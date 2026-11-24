import { AlertDialog } from "radix-ui";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/common/button";
import { CONFIRM_BUTTON_ORDER, ConfirmDialog } from "@/components/common/confirm-dialog";
import { askPlanChanged, PlanChangedDialog } from "@/components/common/plan-changed-dialog";
import { PLAN_CHANGED_KEEP, PLAN_CHANGED_RELOAD, PLAN_CHANGED_TEXT, PLAN_CHANGED_TITLE } from "@/lib/copy";

// Story 15.1 (FR-41): the plan-changed dialog. Vitest has no DOM, so the dialog is walked as a
// plain tree and its handlers are called directly; real focus and keys are covered in
// e2e/user-journeys.spec.ts (uj3 fr41).

type Element = ReactElement<Record<string, unknown>>;

function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}

function dialog() {
  const props = { open: true, onOpenChange: vi.fn(), onReload: vi.fn(), onKeepGoing: vi.fn() };
  const confirm = PlanChangedDialog(props) as Element;
  const tree = elements(ConfirmDialog(confirm.props as Parameters<typeof ConfirmDialog>[0]));
  return { props, confirm, tree };
}

describe("fr41 plan-changed dialog", () => {
  it("fr41_dialog_has_the_exact_copy", () => {
    expect(PLAN_CHANGED_TEXT).toBe(
      "Someone saved this plan after you opened it. Reload it to see their changes, or keep going and your change is added on top of theirs.",
    );
    const { confirm } = dialog();
    expect(confirm.props).toMatchObject({
      title: PLAN_CHANGED_TITLE,
      description: PLAN_CHANGED_TEXT,
      cancelLabel: "Reload plan",
      confirmLabel: "Keep going",
      destructive: false,
    });
  });

  it("fr41_reload_plan_is_in_the_cancel_position_with_default_focus", () => {
    const { tree } = dialog();
    expect(CONFIRM_BUTTON_ORDER).toEqual(["cancel", "confirm"]);
    const buttons = tree.filter((element) => element.type === Button);
    expect(buttons.map((button) => [button.props.children, button.props.variant])).toEqual([
      [PLAN_CHANGED_RELOAD, "tertiary"],
      [PLAN_CHANGED_KEEP, "primary"],
    ]);
    // Radix AlertDialog focuses its Cancel when it opens: Reload plan sits inside it.
    const cancel = tree.find((element) => element.type === AlertDialog.Cancel)!;
    expect((cancel.props.children as Element).props.children).toBe(PLAN_CHANGED_RELOAD);
  });

  it("fr41_buttons_call_reload_and_keep_going", () => {
    const { tree, props } = dialog();
    const [reload, keep] = tree.filter((element) => element.type === Button);
    (reload.props.onClick as () => void)();
    expect(props.onReload).toHaveBeenCalledTimes(1);
    (keep.props.onClick as () => void)();
    expect(props.onKeepGoing).toHaveBeenCalledTimes(1);
  });

  it("fr41_without_a_mounted_host_the_answer_is_reload", async () => {
    await expect(askPlanChanged()).resolves.toBe("reload");
  });
});

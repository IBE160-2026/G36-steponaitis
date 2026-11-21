import { renderToStaticMarkup } from "react-dom/server";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { collapsedLabel, FlowBar } from "@/components/common/app-shell/flow-bar";
import { Button } from "@/components/common/button";
import { ClassGlyph, type MovementClass } from "@/components/common/class-glyph";
import { CONFIRM_BUTTON_ORDER } from "@/components/common/confirm-dialog";
import { Icon, ICON_NAMES } from "@/components/common/icons";
import { Input, InputError } from "@/components/common/input";
import { toastDurationMs } from "@/components/common/toast";

// Shared components (UX-DR3, UX-DR6, UX-DR10, UX-DR11, UX-DR14, UX-DR16) under NFR-10 (WCAG 2.2 AA)
// and NFR-11 (English UI, glossary terms). Rendered to static markup; Vitest has no DOM.

const html = renderToStaticMarkup;

type AnyElement = ReactElement<{ children?: ReactNode; [prop: string]: any }>; // eslint-disable-line @typescript-eslint/no-explicit-any

function findElement(node: ReactNode, type: string): AnyElement | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, type);
      if (found) return found;
    }
    return undefined;
  }
  if (!isValidElement(node)) return undefined;
  const element = node as AnyElement;
  if (element.type === type) return element;
  return findElement(element.props.children, type);
}

describe("nfr10 class glyphs are SVG shapes", () => {
  it.each<MovementClass>(["fast", "medium", "slow", "dead"])("draws %s as an svg without text glyphs", (movementClass) => {
    const markup = html(<ClassGlyph movementClass={movementClass} />);
    expect(markup).toMatch(/^<svg/);
    expect(markup).toMatch(/<path|<circle/);
    expect(markup).not.toMatch(/[▲◆▼⊘]/u);
    expect(markup).toContain('aria-hidden="true"');
  });

  it("is announced as an image when labelled", () => {
    const markup = html(<ClassGlyph movementClass="fast" label="Fast-moving" />);
    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-label="Fast-moving"');
  });
});

describe("nfr10 icon set", () => {
  it("renders all twelve UI icons as outline svgs at a 1.6px stroke", () => {
    expect(ICON_NAMES).toEqual([
      "search", "grid", "lock", "clock", "pin", "palette", "warning", "check", "link", "chevron", "plus", "close",
    ]);
    for (const name of ICON_NAMES) {
      const markup = html(<Icon name={name} />);
      expect(markup, name).toMatch(/^<svg/);
      // absoluteStrokeWidth scales the 24-unit viewBox stroke so it renders at 1.6px at any size.
      const stroke = Number(/stroke-width="([\d.]+)"/.exec(markup)?.[1]);
      expect(stroke * (16 / 24), name).toBeCloseTo(1.6, 5);
      expect(markup, name).toContain('stroke-linecap="round"');
      expect(markup, name).toContain('aria-hidden="true"');
    }
  });
});

describe("nfr10 disabled button says why", () => {
  const markup = html(<Button disabledReason="No moves to undo">Undo last move</Button>);

  it("stays focusable with aria-disabled instead of the native disabled attribute", () => {
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).not.toMatch(/\sdisabled(=|\s|>)/);
    expect(markup).toContain("Undo last move");
  });

  it("links the reason with aria-describedby", () => {
    const describedBy = /aria-describedby="([^"]+)"/.exec(markup)?.[1];
    expect(describedBy).toBeTruthy();
    expect(markup).toContain(`id="${describedBy}" role="tooltip"`);
    expect(markup).toMatch(/role="tooltip"[^>]*>No moves to undo</);
    expect(markup).toContain("group-hover:block");
    expect(markup).toContain("group-has-[:focus-visible]:block");
  });

  it("nfr10 ignores clicks and drops native disabled", () => {
    const spy = vi.fn();
    let tree: ReactNode = null;
    // Button uses hooks, so it is called inside a rendering component to get its element tree.
    function Capture() {
      tree = Button({ disabledReason: "x", onClick: spy, disabled: true, children: "y" });
      return tree;
    }
    html(<Capture />);
    const button = findElement(tree, "button");
    expect(button).toBeDefined();
    expect(button?.props.disabled).toBeUndefined();
    button?.props.onClick({ preventDefault() {}, stopPropagation() {} });
    expect(spy).not.toHaveBeenCalled();
  });

  it("renders a normal button without aria-disabled", () => {
    expect(html(<Button>New Plan</Button>)).not.toContain("aria-disabled");
  });
});

describe("nfr10 input error is linked to its field", () => {
  it("marks the field invalid and describes it by the error", () => {
    const markup = html(
      <>
        <Input aria-describedby="hint" errorId="name-error" />
        <InputError id="name-error">Give the plan a name.</InputError>
      </>,
    );
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('aria-describedby="hint name-error"');
    expect(markup).toContain('id="name-error"');
    expect(markup).toContain('data-icon="warning"');
  });

  it("is not invalid without an error", () => {
    expect(html(<Input />)).not.toContain("aria-invalid");
  });
});

describe("nfr11 flow bar steps", () => {
  it("collapses to Plan steps with no current step", () => {
    expect(collapsedLabel()).toBe("Plan steps");
    const markup = html(<FlowBar />);
    expect(markup).toMatch(/<span>Plan steps<\/span><svg[^>]*data-icon="chevron"/);
  });

  it("collapses to Step N of 8 with a current step", () => {
    expect(collapsedLabel("recommendations")).toBe("Step 6 of 8 · Recommendations");
    expect(html(<FlowBar currentStep="recommendations" />)).toContain("Step 6 of 8 · Recommendations");
  });

  it("lists the eight steps in order inside the Plan steps navigation", () => {
    const markup = html(<FlowBar />);
    expect(markup).toContain('<nav aria-label="Plan steps"');
    const names = [...markup.matchAll(/<span>([^<]+)<\/span><span class="sr-only">/g)].map((m) => m[1]);
    expect(names).toEqual([
      "Overview", "Parts", "Locations", "Pick groups", "Best locations", "Recommendations", "Before/after", "Move list",
    ]);
    expect(markup).not.toContain("aria-current");
    expect(markup).not.toContain("<a ");
  });

  it("marks the current step and announces done steps", () => {
    const markup = html(<FlowBar currentStep="pick-groups" doneSteps={["overview", "parts"]} />);
    expect(markup.match(/aria-current="step"/g)).toHaveLength(1);
    expect(markup).toMatch(/aria-current="step"[^>]*>.*?Pick groups/);
    expect(markup.match(/, done/g)).toHaveLength(2);
    expect(markup).toContain('<span class="sr-only">, step 1, done</span>');
  });

  it("announces a checked current step as done", () => {
    const markup = html(<FlowBar currentStep="overview" doneSteps={["overview", "parts"]} />);
    expect(markup).toMatch(/aria-current="step"[^>]*>.*?Overview<\/span><span class="sr-only">, step 1, done<\/span>/);
    expect(markup.match(/, done/g)).toHaveLength(2);
  });

  it("links steps only when hrefFor is given", () => {
    const markup = html(<FlowBar hrefFor={(step) => `/plans/p1/${step}`} />);
    expect(markup.match(/<a /g)).toHaveLength(8);
    expect(markup).toContain('href="/plans/p1/move-list"');
  });
});

describe("nfr10 toast duration", () => {
  it("shows a short message for 10 seconds and a long one for longer", () => {
    expect(toastDurationMs("x".repeat(40))).toBe(10_000);
    expect(toastDurationMs("x".repeat(300))).toBeGreaterThan(10_000);
    expect(toastDurationMs("x".repeat(300))).toBeLessThan(toastDurationMs("x".repeat(400)));
  });
});

describe("nfr10 confirm dialog puts Cancel first", () => {
  // radix renders the dialog through a portal, which renders nothing on the server, so the
  // footer order is asserted through the constant the dialog builds its buttons from.
  it("orders Cancel before the confirm action", () => {
    expect(CONFIRM_BUTTON_ORDER).toEqual(["cancel", "confirm"]);
  });
});

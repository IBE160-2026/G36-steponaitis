"use client";

// Flow bar (UX-DR6, UX-DR58): the eight plan steps as navigation. From 1024px wide it is a track of
// steps; below that it collapses to one button that opens the same list in a popover. With no plan
// there is nothing to link to, so steps are plain text until `hrefFor` is given (Story 1.9).

import Link from "next/link";
import { Popover } from "radix-ui";

import { Icon } from "@/components/common/icons";
import { cn } from "@/lib/utils";
import { FLOW_STEPS, type FlowStep, type StepKey } from "@/lib/view-state/steps";

export type FlowBarProps = {
  currentStep?: StepKey;
  doneSteps?: readonly StepKey[];
  hrefFor?: (step: StepKey) => string;
};

type StepState = "current" | "done" | "not-reached";

function stepState(step: FlowStep, currentStep: StepKey | undefined, doneSteps: readonly StepKey[]): StepState {
  if (step.key === currentStep) return "current";
  if (doneSteps.includes(step.key)) return "done";
  return "not-reached";
}

/** Text of the collapsed trigger: "Step N of 8 · <name>", or "Plan steps" when no step is current. */
export function collapsedLabel(currentStep?: StepKey): string {
  const step = FLOW_STEPS.find((candidate) => candidate.key === currentStep);
  return step ? `Step ${step.number} of ${FLOW_STEPS.length} · ${step.name}` : "Plan steps";
}

type Tone = "graphite" | "paper";

function StepMarker({ step, state, tone }: { step: FlowStep; state: StepState; tone: Tone }) {
  if (state === "done") {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "grid size-3.5 shrink-0 place-items-center rounded-full",
          tone === "graphite" ? "bg-on-dark-nav text-ink" : "bg-ink text-surface",
        )}
      >
        <Icon name="check" size={10} />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-3.5 shrink-0 place-items-center rounded-full border-[1.2px] type-tag",
        state === "current" && "border-ink text-ink",
        state === "not-reached" &&
          (tone === "graphite" ? "border-on-dark-muted text-on-dark-muted" : "border-ink-secondary text-ink-secondary"),
      )}
    >
      {step.number}
    </span>
  );
}

// A checked step stays announced as done while it is the current step ("Overview, step 1, done").
function StepContent({ step, state, done, tone }: { step: FlowStep; state: StepState; done: boolean; tone: Tone }) {
  return (
    <>
      <StepMarker step={step} state={state} tone={tone} />
      <span>{step.name}</span>
      <span className="sr-only">
        , step {step.number}
        {done ? ", done" : ""}
      </span>
    </>
  );
}

function StepItem({
  step,
  state,
  done,
  tone,
  hrefFor,
}: {
  step: FlowStep;
  state: StepState;
  done: boolean;
  tone: Tone;
  hrefFor?: (step: StepKey) => string;
}) {
  const className = cn(
    "flex items-center gap-1.5 whitespace-nowrap type-button font-medium",
    tone === "graphite" ? "h-[30px] rounded px-2" : "h-control-md rounded px-2",
    state === "current"
      ? tone === "graphite"
        ? "bg-surface text-ink"
        : "bg-selected-tint text-ink"
      : tone === "graphite"
        ? "text-on-dark-nav"
        : "text-ink",
  );
  const ariaCurrent = state === "current" ? ("step" as const) : undefined;
  return (
    <li>
      {hrefFor ? (
        tone === "paper" ? (
          <Popover.Close asChild>
            <Link href={hrefFor(step.key)} className={className} aria-current={ariaCurrent}>
              <StepContent step={step} state={state} done={done} tone={tone} />
            </Link>
          </Popover.Close>
        ) : (
          <Link href={hrefFor(step.key)} className={className} aria-current={ariaCurrent}>
            <StepContent step={step} state={state} done={done} tone={tone} />
          </Link>
        )
      ) : (
        <span className={className} aria-current={ariaCurrent}>
          <StepContent step={step} state={state} done={done} tone={tone} />
        </span>
      )}
    </li>
  );
}

const POPOVER_FADE =
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-150";

export function FlowBar({ currentStep, doneSteps = [], hrefFor }: FlowBarProps) {
  const items = (tone: Tone) =>
    FLOW_STEPS.map((step) => (
      <StepItem
        key={step.key}
        step={step}
        state={stepState(step, currentStep, doneSteps)}
        done={doneSteps.includes(step.key)}
        tone={tone}
        hrefFor={hrefFor}
      />
    ));

  return (
    <nav aria-label="Plan steps" className="min-w-0">
      <ol className="hidden h-[38px] items-center gap-0.5 rounded-xl border border-flow-track-edge bg-flow-track px-[3px] lg:flex">
        {items("graphite")}
      </ol>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="inline-flex h-control-lg items-center gap-2 rounded-lg border border-flow-track-edge bg-flow-track px-3 text-on-dark-nav type-button lg:hidden"
          >
            <span>{collapsedLabel(currentStep)}</span>
            <Icon name="chevron" size={16} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            aria-label="Plan steps"
            align="start"
            sideOffset={6}
            collisionPadding={16}
            className={`z-50 rounded-lg border border-border bg-surface p-1 text-ink shadow-overlay ${POPOVER_FADE}`}
          >
            <ol className="flex flex-col gap-0.5">{items("paper")}</ol>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </nav>
  );
}

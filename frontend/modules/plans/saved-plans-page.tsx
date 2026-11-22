"use client";

// Saved plans (FR-8, AD-20, UX-DR18, UX-DR30): the start page. Every plan from `GET /api/plans`
// in server order (most recently edited first; no user sorts) in the shared DataTable, with New
// Plan as the one primary button. The table is one tab stop: `↑`/`↓` move rows, `Enter` or a
// click opens the plan, and `Tab` reaches the active row's menu button only. The row menu holds
// Open for now; Delete… and New Plan from this import arrive with Stories 6.3 and 6.4.
// When the list fails to load, the page offers Try again and New Plan (epic-1 retro item 5).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";

import { Button, buttonClassName } from "@/components/common/button";
import { type CellContext, DataTable, type DataTableColumn } from "@/components/common/data-table";
import { Icon } from "@/components/common/icons";
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS } from "@/components/common/menu-styles";
import { type SavedPlanRow, usePlans } from "@/lib/api/plans";
import { formatDate, formatDateTime } from "@/lib/format";
import { NEW_PLAN_HREF, planOpenHref } from "@/lib/view-state/urls";

export const PAGE_TITLE = "Saved plans";
export const LOADING_TEXT = "Loading saved plans…";
export const EMPTY_TEXT =
  "No plans yet. A plan starts from the three files the warehouse exports: Locations, Inventory and Transactions.";
export const DEMO_FILES_TEXT = "Demo files: data/sample/";
export const RETRY_LABEL = "Try again";

/** The row menu button's accessible name. */
export function actionsLabel(name: string): string {
  return `Actions for ${name}`;
}

/** The row's menu: its trigger is tabbable only in the active row (UX-DR18). */
export function RowMenu({ plan, isActive }: { plan: SavedPlanRow; isActive: boolean }) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={actionsLabel(plan.name)}
          tabIndex={isActive ? 0 : -1}
          className="inline-flex size-control-sm items-center justify-center rounded-lg text-ink"
        >
          <Icon name="chevron" size={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          collisionPadding={16}
          className={MENU_CONTENT_CLASS}
        >
          <DropdownMenu.Item asChild>
            <Link
              href={planOpenHref(plan.id)}
              className={MENU_ITEM_CLASS}
            >
              Open
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export const COLUMNS: readonly DataTableColumn<SavedPlanRow>[] = [
  { key: "name", header: "Name", cell: (row) => <span className="type-body-strong">{row.name}</span> },
  { key: "data_as_of", header: "Data as of", cell: (row) => formatDate(row.data_as_of) },
  { key: "uploaded_at", header: "Uploaded", cell: (row) => formatDate(row.uploaded_at) },
  { key: "created_by", header: "Created by", cell: (row) => row.created_by },
  { key: "created_at", header: "Created", cell: (row) => formatDateTime(row.created_at) },
  { key: "last_edited_by", header: "Last edited by", cell: (row) => row.last_edited_by },
  { key: "last_edited_at", header: "Last edited", cell: (row) => formatDateTime(row.last_edited_at) },
  {
    key: "actions",
    header: "Actions",
    className: "w-px",
    cell: (row, { isActive }: CellContext) => <RowMenu plan={row} isActive={isActive} />,
  },
];

function NewPlanLink() {
  return (
    <Link href={NEW_PLAN_HREF} className={buttonClassName("primary", "lg")}>
      New Plan
    </Link>
  );
}

export function EmptyPlans() {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="type-body text-ink">{EMPTY_TEXT}</p>
      <p className="type-body text-ink-secondary">{DEMO_FILES_TEXT}</p>
      <NewPlanLink />
    </div>
  );
}

/** The list failed to load: its message, Try again (refetches) and a way on to New Plan. */
export function PlansLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p className="type-body text-ink">{message}</p>
      <div className="flex items-center gap-4">
        <Button variant="secondary" size="md" onClick={onRetry}>
          {RETRY_LABEL}
        </Button>
        <Link href={NEW_PLAN_HREF} className={buttonClassName("link")}>
          New Plan
        </Link>
      </div>
    </div>
  );
}

export type SavedPlansState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; plans: readonly SavedPlanRow[] };

export function SavedPlansView({
  state,
  onRetry,
  onOpen,
}: {
  state: SavedPlansState;
  onRetry: () => void;
  onOpen: (plan: SavedPlanRow) => void;
}) {
  const empty = state.kind === "ready" && state.plans.length === 0;
  // Empty and failed lists offer their own way to New Plan; the header holds it otherwise.
  const headerNewPlan = state.kind === "loading" || (state.kind === "ready" && !empty);
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="type-page-title">{PAGE_TITLE}</h1>
        {headerNewPlan && <NewPlanLink />}
      </div>
      {state.kind === "loading" && (
        <p role="status" className="type-body text-ink-secondary">
          {LOADING_TEXT}
        </p>
      )}
      {state.kind === "error" && <PlansLoadError message={state.message} onRetry={onRetry} />}
      {state.kind === "ready" &&
        (empty ? (
          <EmptyPlans />
        ) : (
          <DataTable
            label={PAGE_TITLE}
            columns={COLUMNS}
            rows={state.plans}
            rowKey={(row) => row.id}
            onOpen={onOpen}
            className="bg-surface"
          />
        ))}
    </div>
  );
}

export function SavedPlansPage() {
  const router = useRouter();
  const plans = usePlans();
  const state: SavedPlansState = plans.data
    ? { kind: "ready", plans: plans.data }
    : plans.isError
      ? { kind: "error", message: plans.error.message }
      : { kind: "loading" };
  return (
    <SavedPlansView
      state={state}
      onRetry={() => void plans.refetch()}
      onOpen={(plan) => router.push(planOpenHref(plan.id))}
    />
  );
}

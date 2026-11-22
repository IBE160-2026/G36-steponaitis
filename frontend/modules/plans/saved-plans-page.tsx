"use client";

// Saved plans (FR-8, AD-20, UX-DR18, UX-DR30): the start page. Every plan from `GET /api/plans`
// in server order (most recently edited first; no user sorts) in the shared DataTable, with New
// Plan as the one primary button. The table is one tab stop: `↑`/`↓` move rows, `Enter` or a
// click opens the plan, and `Tab` reaches the active row's menu button only. The row menu holds
// Open, New Plan from this import (Story 6.3, FR-2) and Delete… (Story 6.4, FR-12, UX-DR16): a
// confirm with Cancel first; after a delete the list refetches and focus moves to the next row,
// or to New Plan when the list is empty. Cancel, `Esc` or a failed delete return focus to the
// row's menu button. When the list fails to load, the page offers Try again and New Plan
// (epic-1 retro item 5).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button, buttonClassName } from "@/components/common/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { type CellContext, DataTable, type DataTableColumn } from "@/components/common/data-table";
import { Icon } from "@/components/common/icons";
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS } from "@/components/common/menu-styles";
import { showToast } from "@/components/common/toast";
import { ApiError, internalError } from "@/lib/api/errors";
import { deletePlan, type SavedPlanRow, usePlans } from "@/lib/api/plans";
import {
  DELETE_PLAN_CONFIRM,
  DELETE_PLAN_ITEM,
  DELETE_PLAN_TITLE,
  deletePlanQuestion,
  LOADING_SAVED_PLANS,
  NEW_PLAN_FROM_IMPORT,
  SAVED_PLANS_TITLE,
} from "@/lib/copy";
import { formatDate, formatDateTime } from "@/lib/format";
import { NEW_PLAN_HREF, newPlanFromHref, planOpenHref } from "@/lib/view-state/urls";

export const EMPTY_TEXT =
  "No plans yet. A plan starts from the three files the warehouse exports: Locations, Inventory and Transactions.";
export const DEMO_FILES_TEXT = "Demo files: data/sample/";
export const RETRY_LABEL = "Try again";

/** The row menu button's accessible name. */
export function actionsLabel(name: string): string {
  return `Actions for ${name}`;
}

/** The id of a row's menu button, so focus can return to it after the delete confirm. */
export function planActionsId(planId: string): string {
  return `plan-actions-${planId}`;
}

/** The id of the empty state's New Plan, focused after the last plan is deleted. */
export const EMPTY_NEW_PLAN_ID = "saved-plans-empty-new-plan";

/**
 * The row to focus after deleting `deletedId` from `rows` (the list as it was before the delete):
 * the row that followed it, the new last row when it was last, or null when no row is left.
 */
export function focusAfterDelete(rows: readonly SavedPlanRow[], deletedId: string): string | null {
  const rest = rows.filter((row) => row.id !== deletedId);
  if (rest.length === 0) return null;
  const index = rows.findIndex((row) => row.id === deletedId);
  if (index < 0) return rest[0].id;
  return rest[Math.min(index, rest.length - 1)].id;
}

type DeleteHandler = (plan: SavedPlanRow) => void;

/** The row's menu: its trigger is tabbable only in the active row (UX-DR18). */
export function RowMenu({
  plan,
  isActive,
  onDelete,
}: {
  plan: SavedPlanRow;
  isActive: boolean;
  onDelete: DeleteHandler;
}) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          id={planActionsId(plan.id)}
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
          <DropdownMenu.Item asChild>
            <Link href={newPlanFromHref(plan.id)} className={MENU_ITEM_CLASS}>
              {NEW_PLAN_FROM_IMPORT}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item className={MENU_ITEM_CLASS} onSelect={() => onDelete(plan)}>
            {DELETE_PLAN_ITEM}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** The saved-plans columns; the row menu's Delete… calls `onDelete`. */
export function planColumns(onDelete: DeleteHandler): readonly DataTableColumn<SavedPlanRow>[] {
  return [
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
      cell: (row, { isActive }: CellContext) => <RowMenu plan={row} isActive={isActive} onDelete={onDelete} />,
    },
  ];
}

function NewPlanLink({ id }: { id?: string }) {
  return (
    <Link id={id} href={NEW_PLAN_HREF} className={buttonClassName("primary", "lg")}>
      New Plan
    </Link>
  );
}

/** The empty list; `focusNewPlan` focuses its New Plan (after the last plan was deleted). */
export function EmptyPlans({ focusNewPlan = false }: { focusNewPlan?: boolean }) {
  useEffect(() => {
    if (focusNewPlan) document.getElementById(EMPTY_NEW_PLAN_ID)?.focus();
  }, [focusNewPlan]);
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="type-body text-ink">{EMPTY_TEXT}</p>
      <p className="type-body text-ink-secondary">{DEMO_FILES_TEXT}</p>
      <NewPlanLink id={EMPTY_NEW_PLAN_ID} />
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

const NO_DELETE: DeleteHandler = () => {};

export function SavedPlansView({
  state,
  onRetry,
  onOpen,
  onDelete = NO_DELETE,
  focusKey,
  focusNewPlan = false,
}: {
  state: SavedPlansState;
  onRetry: () => void;
  onOpen: (plan: SavedPlanRow) => void;
  onDelete?: DeleteHandler;
  /** The row to focus (DataTable `focusKey`). */
  focusKey?: string;
  /** Focus the empty state's New Plan. */
  focusNewPlan?: boolean;
}) {
  // Stable columns keep the memoized rows from re-rendering.
  const columns = useMemo(() => planColumns(onDelete), [onDelete]);
  const empty = state.kind === "ready" && state.plans.length === 0;
  // Empty and failed lists offer their own way to New Plan; the header holds it otherwise.
  const headerNewPlan = state.kind === "loading" || (state.kind === "ready" && !empty);
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="type-page-title">{SAVED_PLANS_TITLE}</h1>
        {headerNewPlan && <NewPlanLink />}
      </div>
      {state.kind === "loading" && (
        <p role="status" className="type-body text-ink-secondary">
          {LOADING_SAVED_PLANS}
        </p>
      )}
      {state.kind === "error" && <PlansLoadError message={state.message} onRetry={onRetry} />}
      {state.kind === "ready" &&
        (empty ? (
          <EmptyPlans focusNewPlan={focusNewPlan} />
        ) : (
          <DataTable
            label={SAVED_PLANS_TITLE}
            columns={columns}
            rows={state.plans}
            rowKey={(row) => row.id}
            onOpen={onOpen}
            focusKey={focusKey}
            className="bg-surface"
          />
        ))}
    </div>
  );
}

function focusActions(planId: string) {
  document.getElementById(planActionsId(planId))?.focus();
}

export function SavedPlansPage() {
  const router = useRouter();
  const plans = usePlans();
  const { refetch } = plans;
  // The plan in the confirm; it stays set while the dialog fades out so its text does not change.
  const [target, setTarget] = useState<SavedPlanRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [focusKey, setFocusKey] = useState<string | undefined>(undefined);
  const [focusNewPlan, setFocusNewPlan] = useState(false);
  const inFlight = useRef(false);
  const confirmed = useRef(false);
  // Resolved when the dialog has closed: its focus trap holds focus until then, so the page
  // places focus only after this.
  const dialogClosed = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  const rowsRef = useRef<readonly SavedPlanRow[]>([]);
  useEffect(() => {
    rowsRef.current = plans.data ?? [];
  }, [plans.data]);

  const requestDelete = useCallback((plan: SavedPlanRow) => {
    if (inFlight.current) return;
    confirmed.current = false;
    let resolve = () => {};
    const promise = new Promise<void>((done) => {
      resolve = done;
    });
    dialogClosed.current = { promise, resolve };
    // Cleared so the same row key or New Plan can take the focus again after this delete.
    setFocusKey(undefined);
    setFocusNewPlan(false);
    setTarget(plan);
    setDialogOpen(true);
  }, []);

  async function confirmDelete(plan: SavedPlanRow) {
    if (inFlight.current) return;
    inFlight.current = true;
    confirmed.current = true;
    const before = rowsRef.current;
    const closed = dialogClosed.current?.promise ?? Promise.resolve();
    try {
      try {
        await deletePlan(plan.id);
      } catch (error) {
        const apiError = error instanceof ApiError ? error : internalError();
        // Someone deleted it already: the same refetch and focus, no toast.
        if (apiError.code !== "plan_not_found") {
          showToast(apiError.message);
          await closed;
          focusActions(plan.id);
          return;
        }
      }
      const after = (await refetch()).data ?? [];
      await closed;
      if (after.length === 0) {
        setFocusNewPlan(true);
        return;
      }
      const next = focusAfterDelete(before, plan.id);
      setFocusKey(next !== null && after.some((row) => row.id === next) ? next : after[0].id);
    } finally {
      inFlight.current = false;
    }
  }

  const state: SavedPlansState = plans.data
    ? { kind: "ready", plans: plans.data }
    : plans.isError
      ? { kind: "error", message: plans.error.message }
      : { kind: "loading" };
  return (
    <>
      <SavedPlansView
        state={state}
        onRetry={() => void refetch()}
        onOpen={(plan) => router.push(planOpenHref(plan.id))}
        onDelete={requestDelete}
        focusKey={focusKey}
        focusNewPlan={focusNewPlan}
      />
      <ConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={DELETE_PLAN_TITLE}
        description={target ? deletePlanQuestion(target.name) : ""}
        confirmLabel={DELETE_PLAN_CONFIRM}
        onConfirm={() => {
          if (target) void confirmDelete(target);
        }}
        onCloseAutoFocus={(event) => {
          // The page places focus itself: the row's menu button after Cancel or `Esc`, the next
          // row or New Plan once a confirmed delete is done.
          event.preventDefault();
          if (!confirmed.current && target) focusActions(target.id);
          dialogClosed.current?.resolve();
        }}
      />
    </>
  );
}

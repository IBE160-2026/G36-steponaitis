"use client";

// Category check (FR-46, UX-DR18, UX-DR24, Story 13.3): every part whose category is not one of the
// categories of the aisle it is in now, in server order (AD-14), with the server's counts. The
// server computes the whole check from one replay (AD-3); the page shows it as given, with no sorts.
// It is a plan view: its query refetches after every move, undo and reset. A part button, or Enter
// on a row, opens that part's panel (`?part=`).

import Link from "next/link";
import { useCallback } from "react";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { LocationChip } from "@/components/common/location-chip";
import { usePanelPlanData, usePartPanel, WithPartPanel } from "@/components/common/part-panel";
import { PlanLoadError, PlanOpening, showsLoadError } from "@/components/common/plan-status";
import {
  CATEGORIES_TITLE,
  CATEGORY_CHECK_AISLE,
  CATEGORY_CHECK_AISLE_CATEGORIES,
  CATEGORY_CHECK_CURRENT_LOCATION,
  CATEGORY_CHECK_DESCRIPTION,
  CATEGORY_CHECK_EMPTY,
  CATEGORY_CHECK_NOTE,
  CATEGORY_CHECK_PART,
  CATEGORY_CHECK_TITLE,
  CATEGORY_LABEL,
  categoryCheckCountLine,
} from "@/lib/copy";
import { type LocationParams, planCategoriesHref, planCategoryCheckHref } from "@/lib/view-state/urls";

import { type CategoryCheck, type CategoryCheckRow, usePlanCategoryCheck } from "./api";

type OpenPart = (part: string, opener?: HTMLElement | null) => void;

export function categoryCheckColumns(planId: string, onOpenPart?: OpenPart): readonly DataTableColumn<CategoryCheckRow>[] {
  return [
    {
      key: "part",
      header: CATEGORY_CHECK_PART,
      cell: (row) => (
        <button
          type="button"
          data-open-part={row.part}
          onClick={(event) => onOpenPart?.(row.part, event.currentTarget)}
          className="rounded-sm type-code-table text-ink underline underline-offset-2"
        >
          {row.part}
        </button>
      ),
    },
    { key: "description", header: CATEGORY_CHECK_DESCRIPTION, cell: (row) => row.description },
    { key: "category", header: CATEGORY_LABEL, cell: (row) => row.category },
    {
      key: "current_location",
      header: CATEGORY_CHECK_CURRENT_LOCATION,
      cell: (row) => <LocationChip planId={planId} location={row.current_location} />,
    },
    { key: "aisle", header: CATEGORY_CHECK_AISLE, cell: (row) => row.current_location.aisle },
    {
      key: "aisle_categories",
      header: CATEGORY_CHECK_AISLE_CATEGORIES,
      cell: (row) => row.aisle_categories.join(", "),
    },
  ];
}

const linkClass = "self-start rounded-sm type-body text-ink underline underline-offset-2";

export function CategoryCheckView({
  planId,
  view,
  onOpenPart,
}: {
  planId: string;
  view: CategoryCheck;
  onOpenPart?: OpenPart;
}) {
  const onOpen = useCallback((row: CategoryCheckRow) => onOpenPart?.(row.part), [onOpenPart]);
  return (
    <div className="flex min-w-0 flex-col gap-4 px-page-gutter py-5">
      <Link href={planCategoriesHref(planId)} className={linkClass}>
        {CATEGORIES_TITLE}
      </Link>
      <h1 className="type-page-title">{CATEGORY_CHECK_TITLE}</h1>
      <p className="type-body text-ink-secondary">{CATEGORY_CHECK_NOTE}</p>
      <p className="type-body text-ink-secondary" data-category-check-count="">
        {categoryCheckCountLine(view.outside_count, view.aisles_without_categories)}
      </p>
      {view.rows.length === 0 ? (
        <p className="type-body text-ink-secondary">{CATEGORY_CHECK_EMPTY}</p>
      ) : (
        <DataTable
          label={CATEGORY_CHECK_TITLE}
          columns={categoryCheckColumns(planId, onOpenPart)}
          rows={view.rows}
          rowKey={(row) => row.part}
          onOpen={onOpen}
          className="bg-surface"
        />
      )}
    </div>
  );
}

export function CategoryCheckPage({ planId }: { planId: string }) {
  const check = usePlanCategoryCheck(planId);
  const href = useCallback((params: LocationParams) => planCategoryCheckHref(planId, params), [planId]);
  const panel = usePartPanel(planId, href);
  const data = usePanelPlanData(planId, check, panel.part);
  if (data) {
    return (
      <WithPartPanel
        planId={planId}
        part={panel.part}
        detail={data.detail}
        detailError={data.detailError}
        onClose={panel.close}
      >
        <CategoryCheckView planId={planId} view={data.view} onOpenPart={panel.open} />
      </WithPartPanel>
    );
  }
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      {showsLoadError(check.error) ? <PlanLoadError message={check.error.message} /> : <PlanOpening planId={planId} />}
    </div>
  );
}

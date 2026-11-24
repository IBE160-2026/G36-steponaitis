"use client";

// Categories (FR-43, FR-45, UX-DR7, Story 13.2): the page CAT opens from the launcher. Two tabs,
// kept in `?tab=keywords|aisles`: the global keyword rules and the categories of this plan's
// import aisles. Not a flow step; it reads the plan only for its aisles and never writes it. A
// "Category check" link opens the check of this plan (FR-46).

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Tabs } from "radix-ui";
import { useCallback } from "react";

import { PlanLoadError, PlanOpening, showsLoadError } from "@/components/common/plan-status";
import {
  AISLE_CATEGORIES_TAB,
  CATEGORIES_TITLE,
  CATEGORY_CHECK_TITLE,
  KEYWORD_RULES_TAB,
  LOADING_AISLE_CATEGORIES,
  LOADING_KEYWORD_RULES,
} from "@/lib/copy";
import { usePlanSummary } from "@/lib/api/plans";
import {
  type CategoriesTab,
  parseCategoriesTab,
  planCategoriesHref,
  planCategoryCheckHref,
} from "@/lib/view-state/urls";

import { AisleCategoriesTab } from "./aisle-categories-tab";
import { useKeywordRules, usePlanAisleCategories } from "./api";
import { KeywordRulesTab } from "./keyword-rules-tab";

const TABS: readonly { value: CategoriesTab; label: string }[] = [
  { value: "keywords", label: KEYWORD_RULES_TAB },
  { value: "aisles", label: AISLE_CATEGORIES_TAB },
];

function Loading({ text }: { text: string }) {
  return (
    <p role="status" className="type-body text-ink-secondary">
      {text}
    </p>
  );
}

function KeywordRulesPanel() {
  const rules = useKeywordRules();
  if (rules.data) return <KeywordRulesTab rules={rules.data.rules} />;
  if (rules.error) return <PlanLoadError message={rules.error.message} />;
  return <Loading text={LOADING_KEYWORD_RULES} />;
}

function AisleCategoriesPanel({ planId }: { planId: string }) {
  const aisles = usePlanAisleCategories(planId);
  if (aisles.data) return <AisleCategoriesTab view={aisles.data} />;
  if (showsLoadError(aisles.error)) return <PlanLoadError message={aisles.error.message} />;
  return <Loading text={LOADING_AISLE_CATEGORIES} />;
}

export function CategoriesView({
  planId,
  tab,
  onTabChange,
}: {
  planId: string;
  tab: CategoriesTab;
  onTabChange: (tab: CategoriesTab) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 px-page-gutter py-5">
      <h1 className="type-page-title">{CATEGORIES_TITLE}</h1>
      <Link
        href={planCategoryCheckHref(planId)}
        className="self-start rounded-sm type-body text-ink underline underline-offset-2"
      >
        {CATEGORY_CHECK_TITLE}
      </Link>
      <Tabs.Root value={tab} onValueChange={(value) => onTabChange(value as CategoriesTab)}>
        <Tabs.List aria-label={CATEGORIES_TITLE} className="flex flex-wrap gap-1 border-b border-border">
          {TABS.map(({ value, label }) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className="-mb-px inline-flex h-control-lg items-center border-b-2 border-transparent px-3 type-tab text-ink-secondary data-[state=active]:border-ink data-[state=active]:text-ink"
            >
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="keywords" className="pt-4 outline-none">
          <KeywordRulesPanel />
        </Tabs.Content>
        <Tabs.Content value="aisles" className="pt-4 outline-none">
          <AisleCategoriesPanel planId={planId} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

export function CategoriesPage({ planId }: { planId: string }) {
  const summary = usePlanSummary(planId);
  const searchParams = useSearchParams();
  const tab = parseCategoriesTab(searchParams);
  const changeTab = useCallback(
    (next: CategoriesTab) => window.history.replaceState(null, "", planCategoriesHref(planId, next)),
    [planId],
  );
  if (summary.data) return <CategoriesView planId={planId} tab={tab} onTabChange={changeTab} />;
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      {showsLoadError(summary.error) ? <PlanLoadError message={summary.error.message} /> : <PlanOpening planId={planId} />}
    </div>
  );
}

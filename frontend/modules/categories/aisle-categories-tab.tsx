"use client";

// Aisle categories tab (FR-45, Story 13.2): one row per aisle of the open plan's import (server
// order), its categories as chips with a × to remove each, and a picker of the keyword rules'
// categories not yet on the aisle. Each change sends the aisle's whole new list
// (PUT /api/aisle-categories/{aisle}) and shows after the refetch. A category no rule gives any
// more stays on the aisle, marked "no keyword rule gives this category" (the server's `has_rule`).

import { useCallback, useId, useState } from "react";

import { Button } from "@/components/common/button";
import { Icon } from "@/components/common/icons";
import { showToast } from "@/components/common/toast";
import { ApiError, internalError } from "@/lib/api/errors";
import {
  ADD_CATEGORY,
  ADD_RULE_FIRST,
  addCategoryLabel,
  AISLE_CATEGORIES_NOTE,
  aisleHeading,
  categoryPickerLabel,
  EVERY_CATEGORY_ON_AISLE,
  NO_AISLE_CATEGORIES,
  NO_AISLES,
  NO_RULE_GIVES_CATEGORY,
  removeCategoryLabel,
  SAVING_CATEGORIES,
} from "@/lib/copy";

import { type AisleCategories, categoriesApi, type PlanAisleCategories, useCategoriesWrite } from "./api";

/**
 * The key categories compare by, mirroring the server's `category_key` (FR-45): drop format
 * characters (Cf), NFC, collapse whitespace to one space and trim, casefold, NFC again.
 */
export function categoryKey(category: string): string {
  const visible = category.replace(/\p{Cf}/gu, "").normalize("NFC");
  const collapsed = visible.split(/\s+/u).filter(Boolean).join(" ");
  return collapsed.toUpperCase().toLowerCase().normalize("NFC");
}

/** The rule categories the picker offers for an aisle: those whose `categoryKey` is not on it yet. */
export function pickerOptions(ruleCategories: readonly string[], aisle: AisleCategories): string[] {
  // The server says which categories exist; this only hides the ones the aisle already shows.
  const shown = new Set(aisle.categories.map((entry) => categoryKey(entry.category)));
  return ruleCategories.filter((category) => !shown.has(categoryKey(category)));
}

export function CategoryChip({
  aisle,
  category,
  hasRule,
  pendingReason,
  onRemove,
}: {
  aisle: string;
  category: string;
  hasRule: boolean;
  pendingReason?: string;
  onRemove: () => void;
}) {
  return (
    <li className="inline-flex items-center gap-1 rounded-full border border-border bg-surface py-0.5 pr-0.5 pl-3">
      <span className="type-body text-ink">{category}</span>
      {!hasRule && <span className="type-caption text-ink-secondary">· {NO_RULE_GIVES_CATEGORY}</span>}
      <Button
        variant="tertiary"
        size="sm"
        className="rounded-full border-transparent px-1.5"
        aria-label={removeCategoryLabel(category, aisle)}
        disabledReason={pendingReason}
        onClick={onRemove}
      >
        <Icon name="close" size={14} />
      </Button>
    </li>
  );
}

export function AisleRow({
  entry,
  ruleCategories,
  pendingReason,
  onChange,
}: {
  entry: AisleCategories;
  ruleCategories: readonly string[];
  pendingReason?: string;
  onChange: (aisle: string, categories: string[]) => void;
}) {
  const pickerId = useId();
  const headingId = useId();
  const options = pickerOptions(ruleCategories, entry);
  const [chosen, setChosen] = useState("");
  const value = options.includes(chosen) ? chosen : (options[0] ?? "");
  const current = entry.categories.map((item) => item.category);
  return (
    <li aria-labelledby={headingId} className="flex flex-col gap-2 border-b border-hairline py-3 sm:flex-row sm:items-start sm:gap-4">
      <h3 id={headingId} className="w-28 shrink-0 pt-1 type-body-strong text-ink">
        {aisleHeading(entry.aisle)}
      </h3>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {entry.categories.length === 0 ? (
          <p className="pt-1 type-body text-ink-secondary">{NO_AISLE_CATEGORIES}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {entry.categories.map((item) => (
              <CategoryChip
                key={item.category}
                aisle={entry.aisle}
                category={item.category}
                hasRule={item.has_rule}
                pendingReason={pendingReason}
                onRemove={() => onChange(entry.aisle, current.filter((category) => category !== item.category))}
              />
            ))}
          </ul>
        )}
        {ruleCategories.length === 0 ? null : options.length === 0 ? (
          <p className="type-caption text-ink-secondary">{EVERY_CATEGORY_ON_AISLE}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={pickerId} className="sr-only">
              {categoryPickerLabel(entry.aisle)}
            </label>
            <select
              id={pickerId}
              value={value}
              onChange={(event) => setChosen(event.currentTarget.value)}
              className="h-control-md min-w-40 rounded-lg border border-input-border bg-surface px-2 text-ink type-body"
            >
              {options.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              size="md"
              aria-label={addCategoryLabel(entry.aisle)}
              disabledReason={pendingReason}
              onClick={() => onChange(entry.aisle, [...current, value])}
            >
              {ADD_CATEGORY}
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

/** The tab's view: the note, "add a rule first" when no rule exists, and one row per aisle. */
export function AisleCategoriesView({
  view,
  pendingReason,
  onChange,
}: {
  view: PlanAisleCategories;
  pendingReason?: string;
  onChange: (aisle: string, categories: string[]) => void;
}) {
  return (
    <div className="flex max-w-[960px] flex-col gap-3">
      <p className="type-body text-ink-secondary">{AISLE_CATEGORIES_NOTE}</p>
      {view.rule_categories.length === 0 && <p className="type-body text-ink">{ADD_RULE_FIRST}</p>}
      {view.aisles.length === 0 ? (
        <p className="type-body text-ink-secondary">{NO_AISLES}</p>
      ) : (
        <ul className="flex flex-col border-t border-hairline">
          {view.aisles.map((entry) => (
            <AisleRow
              key={entry.aisle}
              entry={entry}
              ruleCategories={view.rule_categories}
              pendingReason={pendingReason}
              onChange={onChange}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** The tab with its write: the aisle's whole new list, shown after the server confirms it. */
export function AisleCategoriesTab({ view }: { view: PlanAisleCategories }) {
  const write = useCategoriesWrite();
  const [pending, setPending] = useState(false);
  const change = useCallback(
    async (aisle: string, categories: string[]) => {
      setPending(true);
      try {
        await write(() => categoriesApi.setAisleCategories(aisle, categories));
      } catch (error) {
        showToast((error instanceof ApiError ? error : internalError()).message);
      } finally {
        setPending(false);
      }
    },
    [write],
  );
  return (
    <AisleCategoriesView
      view={view}
      pendingReason={pending ? SAVING_CATEGORIES : undefined}
      onChange={(aisle, categories) => void change(aisle, categories)}
    />
  );
}

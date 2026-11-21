"use client";

// SearchField (FR-15, UX-DR8, UX-DR11): one field that finds parts and locations through
// GET /api/plans/{id}/search?q=. The server matches and orders the results (AD-3, AD-14); this
// field never filters them. Parts and locations are listed apart; a part opens the part panel, a
// location opens the Locations table at its aisle with the row focused. `Ctrl+/` (`⌘/`) focuses the
// field from anywhere on the page; a plain `/` never does. `Esc` clears the field, then blurs it.

import Link from "next/link";
import { type ChangeEvent, type FocusEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";

import { ClassGlyph } from "@/components/common/class-glyph";
import { Icon } from "@/components/common/icons";
import { Input } from "@/components/common/input";
import { locationChipHref } from "@/components/common/location-chip";
import { PlanLoadError, showsLoadError } from "@/components/common/plan-status";
import { type SearchView, usePlanSearch } from "@/lib/api/plans";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const SEARCH_LABEL = "Search parts and locations";

type ShortcutEvent = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">;

/** `Ctrl+/` or `⌘/` focuses the search field; a plain `/` (or with Alt) never does. */
export function isSearchShortcut(event: ShortcutEvent): boolean {
  return event.key === "/" && (event.ctrlKey || event.metaKey) && !event.altKey;
}

/** `No part or location matches “oil”.` with the trimmed query in curly quotes. */
export function noMatchText(query: string): string {
  return `No part or location matches “${query.trim()}”.`;
}

/** "20 of 1,545" when the server capped the list, else null. */
export function cappedLine(shown: number, count: number): string | null {
  return count > shown ? `${formatNumber(shown)} of ${formatNumber(count)}` : null;
}

function ResultGroup({
  title,
  shown,
  count,
  empty,
  children,
}: {
  title: string;
  shown: number;
  count: number;
  empty: string;
  children: ReactNode;
}) {
  const headingId = useId();
  const capped = cappedLine(shown, count);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 px-2">
        <h2 id={headingId} className="type-column-head text-ink-secondary">
          {title}
        </h2>
        {capped && <span className="type-meta text-ink-secondary">{capped}</span>}
      </div>
      {shown > 0 ? (
        <ul className="flex flex-col">{children}</ul>
      ) : (
        <p className="px-2 type-body text-ink-secondary">{empty}</p>
      )}
    </section>
  );
}

const RESULT_ROW = "flex w-full items-baseline gap-2 rounded-sm px-2 py-1 text-left hover:bg-ground";

/** The grouped results of one search (no data fetching). */
export function SearchResults({
  planId,
  view,
  onOpenPart,
  onChoose,
}: {
  planId: string;
  view: SearchView;
  onOpenPart: (part: string) => void;
  onChoose?: () => void;
}) {
  if (view.part_count === 0 && view.location_count === 0) {
    return (
      <p role="status" className="px-2 type-body text-ink">
        {noMatchText(view.query)}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <ResultGroup title="Parts" shown={view.parts.length} count={view.part_count} empty="No parts">
        {view.parts.map((match) => (
          <li key={match.part}>
            <button type="button" data-search-part={match.part} onClick={() => onOpenPart(match.part)} className={RESULT_ROW}>
              <ClassGlyph movementClass={match.movement_class} size={9} />
              <span className="type-code-table text-ink">{match.part}</span>
              <span className="min-w-0 truncate type-body text-ink">{match.description}</span>
            </button>
          </li>
        ))}
      </ResultGroup>
      <ResultGroup title="Locations" shown={view.locations.length} count={view.location_count} empty="No locations">
        {view.locations.map(({ location }) => (
          <li key={location.code}>
            <Link
              href={locationChipHref(planId, location)}
              data-search-location={location.code}
              onClick={onChoose}
              className={RESULT_ROW}
            >
              <span className="type-code-table text-ink">{location.code}</span>
              <span className="type-meta text-ink-secondary">Aisle {location.aisle}</span>
            </Link>
          </li>
        ))}
      </ResultGroup>
    </div>
  );
}

export function SearchField({
  planId,
  onOpenPart,
  className,
}: {
  planId: string;
  /** Opens the part panel; the search input is the opener focus returns to. */
  onOpenPart: (part: string, opener: HTMLElement | null) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const resultsId = useId();
  const search = usePlanSearch(planId, query);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isSearchShortcut(event)) return;
      event.preventDefault();
      input.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
    setOpen(event.target.value.trim() !== "");
  }

  const showing = open && query.trim() !== "";

  function onBlur(event: FocusEvent<HTMLDivElement>) {
    // Focus moving to an element outside the field and its results closes the results.
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }

  return (
    <div className={cn("relative w-full max-w-[360px]", className)} onBlur={onBlur}>
      <div className="relative">
        <Icon name="search" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-secondary" />
        <Input
          ref={input}
          type="search"
          aria-label={SEARCH_LABEL}
          placeholder={SEARCH_LABEL}
          autoComplete="off"
          aria-controls={showing ? resultsId : undefined}
          value={query}
          onChange={onChange}
          onClick={() => setOpen(query.trim() !== "")}
          className="h-control-md pl-9"
        />
      </div>
      {showing && (
        <div
          id={resultsId}
          role="region"
          aria-label="Search results"
          // Keep focus in the field while a result is clicked.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute top-full right-0 left-0 z-20 mt-1 max-h-[480px] overflow-y-auto rounded-lg border border-border bg-surface p-2 shadow-overlay"
        >
          {search.data ? (
            <SearchResults
              planId={planId}
              view={search.data}
              onOpenPart={(part) => {
                setOpen(false);
                onOpenPart(part, input.current);
              }}
              onChoose={() => setOpen(false)}
            />
          ) : showsLoadError(search.error) ? (
            <PlanLoadError message={search.error.message} />
          ) : (
            <p role="status" className="px-2 type-body text-ink-secondary">
              Searching…
            </p>
          )}
        </div>
      )}
    </div>
  );
}

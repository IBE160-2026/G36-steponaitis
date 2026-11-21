"use client";

// One file tile (UX-DR19, UX-DR20): a labelled file input showing the chosen file and, after a
// rejected import, whether this file passed, failed or was not checked. Never colour alone.

import { type ChangeEvent, useId } from "react";

import { Icon } from "@/components/common/icons";
import { InputError } from "@/components/common/input";
import { cn } from "@/lib/utils";

import {
  type ChosenFile,
  FAILED_TILE_TEXT,
  type FileRole,
  fileSizeText,
  NOT_CHECKED_TILE_TEXT,
  PASSED_TILE_TEXT,
  ROLE_LABELS,
  type TileState,
} from "./selection";

export const ACCEPTED_FILES = ".xlsx,.csv";

type FileTileProps = {
  role: FileRole;
  file: ChosenFile | null;
  /** "Choose the <Role> file." when the planner submitted without one. */
  missingError?: string;
  state?: TileState;
  /** Id of the import error panel; the failing tile is described by it. */
  panelId?: string;
  disabled?: boolean;
  onChoose?: (role: FileRole, file: File | null) => void;
};

export function FileTile({ role, file, missingError, state, panelId, disabled, onChoose }: FileTileProps) {
  const inputId = useId();
  const headingId = useId();
  const errorId = useId();
  const stateId = useId();
  const label = ROLE_LABELS[role];
  const failed = state === "failed";

  const describedBy =
    [missingError && errorId, state && stateId, failed && panelId].filter(Boolean).join(" ") || undefined;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.currentTarget.files?.[0] ?? null;
    // Cancelling the browser's file dialog keeps the file already chosen.
    // Clear the native value (the File is kept in state) so re-choosing the same path fires change.
    event.currentTarget.value = "";
    if (chosen) onChoose?.(role, chosen);
  }

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-lg border bg-surface p-panel-padding",
        failed ? "border-[1.5px] border-error" : "border-border",
      )}
      data-role={role}
      data-state={state ?? "none"}
    >
      <p id={headingId} className="type-panel-title text-ink">
        {label}
      </p>
      {/* The native input stays in the tab order (Space opens the file dialog); the visible
          "Choose file" label below opens it on click and carries its focus ring. */}
      <input
        id={inputId}
        type="file"
        accept={ACCEPTED_FILES}
        disabled={disabled}
        aria-labelledby={headingId}
        aria-invalid={missingError || failed ? true : undefined}
        aria-describedby={describedBy}
        onChange={handleChange}
        className="peer sr-only"
      />
      <label
        htmlFor={inputId}
        className={cn(
          "inline-flex h-control-md w-fit items-center rounded-lg border px-3 type-button",
          "peer-focus-visible:shadow-[0_0_0_2px_var(--color-focus-gap),0_0_0_4px_var(--color-focus-on-light)]",
          disabled
            ? "cursor-not-allowed border-border bg-surface-disabled text-ink-disabled"
            : "cursor-pointer border-ink bg-surface text-ink",
        )}
      >
        {file ? "Replace file" : "Choose file"}
      </label>
      {file ? (
        <p className="flex min-w-0 items-baseline gap-2 type-body">
          <span className="min-w-0 truncate font-semibold text-ink" title={file.name}>
            {file.name}
          </span>
          <span className="shrink-0 text-ink-secondary">{fileSizeText(file.size)}</span>
        </p>
      ) : (
        <p className="text-ink-muted type-caption">.xlsx or .csv</p>
      )}
      {missingError && <InputError id={errorId}>{missingError}</InputError>}
      {state && <TileMark id={stateId} state={state} />}
    </div>
  );
}

function TileMark({ id, state }: { id: string; state: TileState }) {
  if (state === "failed") {
    return (
      <p id={id} className="flex items-start gap-2 text-ink type-caption font-semibold">
        <Icon name="warning" size={16} className="text-error" />
        <span>{FAILED_TILE_TEXT}</span>
      </p>
    );
  }
  if (state === "passed") {
    return (
      <p id={id} className="flex items-start gap-2 text-ink type-caption">
        <Icon name="check" size={16} className="text-best-on-light" />
        <span>{PASSED_TILE_TEXT}</span>
      </p>
    );
  }
  return (
    <p id={id} className="text-ink-secondary type-caption">
      {NOT_CHECKED_TILE_TEXT}
    </p>
  );
}

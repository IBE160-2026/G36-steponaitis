// New Plan form logic (FR-1, FR-3, FR-4, UX-DR19, UX-DR20): pure functions, no React.

import { type ApiError, type ApiErrorDetail } from "@/lib/api/errors";
import { formatDate, formatNumber, megabytesExact, megabytesOneDecimal, megabytesRoundedUp } from "@/lib/format";

export const ROLES = ["locations", "inventory", "transactions"] as const;
export type FileRole = (typeof ROLES)[number];

export const ROLE_LABELS: Record<FileRole, string> = {
  locations: "Locations",
  inventory: "Inventory",
  transactions: "Transactions",
};

/** The part of a chosen `File` the form logic needs. */
export type ChosenFile = { name: string; size: number };
export type ChosenFiles<F extends ChosenFile = ChosenFile> = Record<FileRole, F | null>;

export const NAME_REQUIRED = "Give the plan a name.";
export const IN_FLIGHT_REASON = "The plan is being created.";
export const SERVER_STEP_TEXT = "Checking files and computing classes and pick groups…";
export const IMPORT_STOPPED = "Import stopped: nothing was saved.";
export const FAILED_TILE_TEXT = "Failed. Choose a corrected file.";
export const PASSED_TILE_TEXT = "Passed";
export const NOT_CHECKED_TILE_TEXT = "Not checked. Fix the other files first.";

export function emptyFiles<F extends ChosenFile>(): ChosenFiles<F> {
  return { locations: null, inventory: null, transactions: null };
}

export function missingFileMessage(role: FileRole): string {
  return `Choose the ${ROLE_LABELS[role]} file.`;
}

export function totalBytes(files: ChosenFiles): number {
  return ROLES.reduce((sum, role) => sum + (files[role]?.size ?? 0), 0);
}

/** The over-size sentence, or null when the files fit (or the limit is not known yet). */
export function oversizeMessage(total: number, maxBytes: number | undefined): string | null {
  if (maxBytes === undefined || total <= maxBytes) return null;
  return (
    `These files are ${megabytesRoundedUp(total)} MB together. ` +
    `One New Plan can upload at most ${megabytesExact(maxBytes)} MB.`
  );
}

export function fileSizeText(bytes: number): string {
  return `${megabytesRoundedUp(bytes)} MB`;
}

export function progressText(loaded: number, total: number): string {
  const sent = Math.min(loaded, total);
  return `Uploading 3 files · ${megabytesOneDecimal(sent)} of ${megabytesOneDecimal(total)} MB`;
}

export function createdToast(name: string, dataAsOf: string): string {
  return `${name} created. Data as of ${formatDate(dataAsOf)}.`;
}

export type FormErrors = { name: string | null; files: Partial<Record<FileRole, string>> };

/** Check the form before anything is sent; `ok` is true only when nothing is missing. */
export function validateForm(name: string, files: ChosenFiles): FormErrors & { ok: boolean } {
  const nameError = name.trim() === "" ? NAME_REQUIRED : null;
  const fileErrors: Partial<Record<FileRole, string>> = {};
  for (const role of ROLES) {
    if (!files[role]) fileErrors[role] = missingFileMessage(role);
  }
  return { name: nameError, files: fileErrors, ok: nameError === null && Object.keys(fileErrors).length === 0 };
}

// `import_invalid` details: one FileCheck per file (backend swp.domain.import_.FileCheck).
export type TileState = "passed" | "failed" | "not_checked";
type FileCheck = {
  role: FileRole;
  fileName: string;
  status: TileState;
  messages: string[];
  moreCount: number;
};

function isRole(value: unknown): value is FileRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

function isStatus(value: unknown): value is TileState {
  return value === "passed" || value === "failed" || value === "not_checked";
}

function fileChecks(details: ApiErrorDetail[]): FileCheck[] {
  const checks: FileCheck[] = [];
  for (const detail of details) {
    if (!isRole(detail.file_role) || !isStatus(detail.status)) continue;
    const errors = Array.isArray(detail.errors) ? detail.errors : [];
    const messages = errors
      .map((error) => (typeof error === "object" && error !== null ? (error as { message?: unknown }).message : null))
      .filter((message): message is string => typeof message === "string");
    const more = Number(detail.more_count);
    checks.push({
      role: detail.file_role,
      fileName: typeof detail.file_name === "string" ? detail.file_name : "",
      status: detail.status,
      messages,
      moreCount: Number.isInteger(more) && more > 0 ? more : 0,
    });
  }
  return checks;
}

export function tileStatesFrom(details: ApiErrorDetail[]): Partial<Record<FileRole, TileState>> {
  const states: Partial<Record<FileRole, TileState>> = {};
  for (const check of fileChecks(details)) states[check.role] = check.status;
  return states;
}

export function moreText(count: number): string {
  return `and ${formatNumber(count)} more in this file`;
}

export type ImportErrorGroup = { role: FileRole; fileName: string; lines: string[]; more: string | null };

/** The failed files, in role order, with their messages as sent and the "and N more" line. */
export function importErrorGroups(details: ApiErrorDetail[]): ImportErrorGroup[] {
  return fileChecks(details)
    .filter((check) => check.status === "failed")
    .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role))
    .map((check) => ({
      role: check.role,
      fileName: check.fileName,
      lines: check.messages,
      more: check.moreCount > 0 ? moreText(check.moreCount) : null,
    }));
}

/** What the page shows for a rejected request; the UI branches only on `code` (AD-11). */
export type ErrorView =
  | { kind: "import"; tiles: Partial<Record<FileRole, TileState>>; groups: ImportErrorGroup[] }
  | { kind: "name"; message: string }
  | { kind: "message"; message: string }
  /** The session ended (401): Log in opens through the shared flow; nothing is shown here. */
  | { kind: "session" };

export function errorView(error: ApiError): ErrorView {
  if (error.code === "unauthenticated") return { kind: "session" };
  if (error.code === "import_invalid") {
    return { kind: "import", tiles: tileStatesFrom(error.details), groups: importErrorGroups(error.details) };
  }
  if (error.code === "validation_failed") {
    const detail = error.details.find((d) => d.field === "name");
    if (detail) return { kind: "name", message: typeof detail.message === "string" ? detail.message : error.message };
  }
  return { kind: "message", message: error.message };
}

// Reusing a saved plan's import (FR-2, UX-DR17): the Listbox of saved plans replaces the tiles.
export const REUSE_OPTION_TEXT = "Or reuse the import of a saved plan";
export const UPLOAD_INSTEAD_TEXT = "Upload three files instead";
export const CHOOSE_PLAN = "Choose a saved plan.";
export const NO_SAVED_PLANS = "No saved plans yet. Upload three files instead.";

/** The second line of a saved plan's option: its data-as-of date. */
export function reuseOptionMeta(dataAsOf: string): string {
  return `Data as of ${formatDate(dataAsOf)}`;
}

export type ReuseErrors = { name: string | null; plan: string | null };

/** Check the reuse form before anything is sent; `ok` only with a name and a chosen plan. */
export function validateReuse(name: string, chosenPlanId: string | undefined): ReuseErrors & { ok: boolean } {
  const nameError = name.trim() === "" ? NAME_REQUIRED : null;
  const planError = chosenPlanId ? null : CHOOSE_PLAN;
  return { name: nameError, plan: planError, ok: nameError === null && planError === null };
}

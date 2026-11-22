"use client";

// New Plan screen (FR-1, FR-3 to FR-7, UX-DR19, UX-DR20, AD-6): a name, three files and one
// primary New Plan button. The upload runs in two stages (upload with Cancel, then the server
// step without) and is never retried. On success the planner lands on the plan's overview.
// "Or reuse the import of a saved plan" (FR-2, UX-DR17) swaps the three tiles for a Listbox of
// saved plans; `?from=<planId>` opens it with that plan chosen. A reuse sends only the name and
// the chosen plan's `import_id`, so it has no upload progress and no size check.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/common/button";
import { Icon } from "@/components/common/icons";
import { Input, InputError } from "@/components/common/input";
import { Listbox } from "@/components/common/listbox";
import { showToast } from "@/components/common/toast";
import { ApiError, internalError } from "@/lib/api/errors";
import { PLANS_KEY, type SavedPlanRow, usePlans } from "@/lib/api/plans";
import { useSession } from "@/lib/api/session";
import { LOADING_SAVED_PLANS, SAVED_PLANS_TITLE } from "@/lib/copy";
import { planStepHref } from "@/lib/view-state/urls";

import { FileTile } from "./file-tile";
import { ImportErrorPanel, type PanelContent } from "./import-error-panel";
import {
  type ChosenFiles,
  createdToast,
  emptyFiles,
  errorView,
  type FileRole,
  type FormErrors,
  IN_FLIGHT_REASON,
  NO_SAVED_PLANS,
  oversizeMessage,
  progressText,
  REUSE_OPTION_TEXT,
  reuseOptionMeta,
  ROLES,
  SERVER_STEP_TEXT,
  type TileState,
  totalBytes,
  UPLOAD_INSTEAD_TEXT,
  validateForm,
  validateReuse,
} from "./selection";
import {
  type CreatedPlan,
  isUploadCancelled,
  type ReuseForm,
  reusePlan,
  type UploadForm,
  uploadPlan,
} from "./upload";

type Stage = { kind: "idle" } | { kind: "upload"; loaded: number; total: number } | { kind: "server" };

type Mode = "files" | "reuse";

type Submission = { kind: "files"; form: UploadForm } | { kind: "reuse"; form: ReuseForm };

export type ReusePickerProps = {
  plans: readonly SavedPlanRow[] | undefined;
  loadError: string | null;
  chosenPlanId: string | undefined;
  error: string | null;
  errorId: string;
  disabled: boolean;
  onChoose: (plan: SavedPlanRow) => void;
};

/** The saved plans whose import a new plan can reuse, as a Listbox (FR-2, UX-DR17). */
export function ReusePicker({ plans, loadError, chosenPlanId, error, errorId, disabled, onChoose }: ReusePickerProps) {
  let body;
  if (loadError !== null) {
    body = <p className="type-body text-ink">{loadError}</p>;
  } else if (plans === undefined) {
    body = (
      <p role="status" className="type-body text-ink-secondary">
        {LOADING_SAVED_PLANS}
      </p>
    );
  } else if (plans.length === 0) {
    body = <p className="type-body text-ink-secondary">{NO_SAVED_PLANS}</p>;
  } else {
    body = (
      <Listbox
        label={SAVED_PLANS_TITLE}
        options={plans}
        optionKey={(plan) => plan.id}
        selectedKey={chosenPlanId}
        onSelect={onChoose}
        describedBy={error ? errorId : undefined}
        invalid={error !== null}
        disabled={disabled}
        renderOption={(plan) => (
          <>
            <span className="min-w-0 flex-1 truncate type-body-strong">{plan.name}</span>
            <span className="shrink-0 type-caption text-ink-secondary">{reuseOptionMeta(plan.data_as_of)}</span>
          </>
        )}
      />
    );
  }
  return (
    <div className="flex max-w-[640px] flex-col gap-1">
      <span className="type-body-strong text-ink">{SAVED_PLANS_TITLE}</span>
      {body}
      {error && <InputError id={errorId}>{error}</InputError>}
    </div>
  );
}

const NO_ERRORS: FormErrors = { name: null, files: {} };

function without<V>(record: Partial<Record<FileRole, V>>, role: FileRole): Partial<Record<FileRole, V>> {
  const copy = { ...record };
  delete copy[role];
  return copy;
}

export function NewPlanPage({ from }: { from?: string } = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();
  const plans = usePlans();
  const nameId = useId();
  const nameErrorId = useId();
  const panelId = useId();
  const planErrorId = useId();

  const [name, setName] = useState("");
  const [files, setFiles] = useState<ChosenFiles<File>>(emptyFiles);
  const [errors, setErrors] = useState<FormErrors>(NO_ERRORS);
  const [tileStates, setTileStates] = useState<Partial<Record<FileRole, TileState>>>({});
  const [panel, setPanel] = useState<PanelContent | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [navigating, setNavigating] = useState(false);
  const [mode, setMode] = useState<Mode>(from ? "reuse" : "files");
  const [chosenPlanId, setChosenPlanId] = useState<string | undefined>(from);
  const [planError, setPlanError] = useState<string | null>(null);
  // The toggle that was activated unmounts with its mode; focus moves to the other mode's toggle,
  // which renders in the same place (only after a switch, never on first render).
  const reuseToggleRef = useRef<HTMLButtonElement>(null);
  const filesToggleRef = useRef<HTMLButtonElement>(null);
  const modeSwitched = useRef(false);

  useEffect(() => {
    if (!modeSwitched.current) return;
    modeSwitched.current = false;
    (mode === "reuse" ? filesToggleRef : reuseToggleRef).current?.focus();
  }, [mode]);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const unmounted = useRef(false);

  // Leaving the page aborts an upload in flight; a plan that still arrives does not pull the
  // planner back (no toast, no navigation).
  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      controller.current?.abort();
    };
  }, []);

  const mutation = useMutation<CreatedPlan, Error, Submission>({
    retry: 0,
    mutationFn: (submission) => {
      if (submission.kind === "reuse") return reusePlan(submission.form);
      const form = submission.form;
      const abort = new AbortController();
      controller.current = abort;
      return uploadPlan(form, {
        signal: abort.signal,
        onProgress: (loaded, total) => setStage({ kind: "upload", loaded, total }),
        onServerStep: () => setStage({ kind: "server" }),
      });
    },
    onSuccess: (plan) => {
      // The `/` redirect reads the saved-plans list; a new plan must show up there.
      void queryClient.invalidateQueries({ queryKey: PLANS_KEY });
      if (unmounted.current) return;
      setNavigating(true);
      showToast(createdToast(plan.name, plan.data_as_of));
      router.push(planStepHref(plan.id, "overview"));
    },
    onError: (error, submission) => {
      inFlight.current = false;
      setStage({ kind: "idle" });
      if (isUploadCancelled(error)) return;
      const apiError = error instanceof ApiError ? error : internalError();
      // The chosen plan's import is gone: the list is out of date.
      if (submission.kind === "reuse" && apiError.code === "not_found") void plans.refetch();
      showError(apiError);
    },
    onSettled: () => {
      controller.current = null;
    },
  });

  function showError(error: ApiError) {
    const view = errorView(error);
    if (view.kind === "import") {
      setTileStates(view.tiles);
      setPanel({ kind: "import", groups: view.groups });
    } else if (view.kind === "name") {
      setErrors({ name: view.message, files: {} });
    } else {
      setPanel({ kind: "message", message: view.message });
    }
  }

  const busy = mutation.isPending || navigating;
  const oversize =
    mode === "files" ? oversizeMessage(totalBytes(files), session.data?.max_upload_bytes) : null;
  // Only a listed plan counts as chosen (an unknown `?from=` selects nothing).
  const chosenPlan = plans.data?.find((plan) => plan.id === chosenPlanId);
  const disabledReason = busy ? IN_FLIGHT_REASON : (oversize ?? undefined);

  function choose(role: FileRole, file: File | null) {
    setFiles((current) => ({ ...current, [role]: file }));
    setTileStates((current) => without(current, role));
    setErrors((current) => ({ ...current, files: without(current.files, role) }));
  }

  function switchMode(next: Mode) {
    modeSwitched.current = true;
    setMode(next);
    setPanel(null);
    setTileStates({});
    setPlanError(null);
    setErrors((current) => ({ ...current, files: {} }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || busy || oversize) return;
    setPanel(null);
    setTileStates({});
    if (mode === "reuse") {
      const reuse = validateReuse(name, chosenPlan?.id);
      setErrors({ name: reuse.name, files: {} });
      setPlanError(reuse.plan);
      if (!reuse.ok || !chosenPlan) return;
      inFlight.current = true;
      mutation.mutate({ kind: "reuse", form: { name: name.trim(), importId: chosenPlan.import_id } });
      return;
    }
    const checked = validateForm(name, files);
    setErrors({ name: checked.name, files: checked.files });
    if (!checked.ok) return;

    const chosen = files as Record<FileRole, File>;
    inFlight.current = true;
    setStage({ kind: "upload", loaded: 0, total: totalBytes(chosen) });
    mutation.mutate({ kind: "files", form: { name: name.trim(), files: chosen } });
  }

  function cancel() {
    controller.current?.abort();
  }

  let status = "";
  if (stage.kind === "upload") status = progressText(stage.loaded, stage.total);
  else if (stage.kind === "server") status = SERVER_STEP_TEXT;

  return (
    <div className="flex max-w-[960px] flex-col gap-5 px-page-gutter py-5">
      <h1 className="type-page-title">New Plan</h1>
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex max-w-[420px] flex-col gap-1">
          <label htmlFor={nameId} className="type-body-strong text-ink">
            Plan name
          </label>
          <Input
            id={nameId}
            name="name"
            autoComplete="off"
            value={name}
            disabled={busy}
            errorId={errors.name ? nameErrorId : undefined}
            onChange={(event) => {
              setName(event.currentTarget.value);
              setErrors((current) => (current.name ? { ...current, name: null } : current));
            }}
          />
          {errors.name && <InputError id={nameErrorId}>{errors.name}</InputError>}
        </div>

        {mode === "files" ? (
          <>
            <div className="grid grid-cols-1 gap-panel-gap md:grid-cols-3">
              {ROLES.map((role) => (
                <FileTile
                  key={role}
                  role={role}
                  file={files[role]}
                  missingError={errors.files[role]}
                  state={tileStates[role]}
                  panelId={panel ? panelId : undefined}
                  disabled={busy}
                  onChoose={choose}
                />
              ))}
            </div>
            <div>
              <Button
                ref={reuseToggleRef}
                variant="link"
                disabledReason={busy ? IN_FLIGHT_REASON : undefined}
                onClick={() => switchMode("reuse")}
              >
                {REUSE_OPTION_TEXT}
              </Button>
            </div>
          </>
        ) : (
          <>
            <ReusePicker
              plans={plans.data}
              loadError={plans.isError ? plans.error.message : null}
              chosenPlanId={chosenPlan?.id}
              error={planError}
              errorId={planErrorId}
              disabled={busy}
              onChoose={(plan) => {
                setChosenPlanId(plan.id);
                setPlanError(null);
              }}
            />
            <div>
              <Button
                ref={filesToggleRef}
                variant="link"
                disabledReason={busy ? IN_FLIGHT_REASON : undefined}
                onClick={() => switchMode("files")}
              >
                {UPLOAD_INSTEAD_TEXT}
              </Button>
            </div>
          </>
        )}

        {panel && <ImportErrorPanel id={panelId} content={panel} />}

        {oversize && !busy && (
          <p className="flex items-start gap-2 text-ink type-body">
            <Icon name="warning" size={16} className="mt-px text-error" />
            <span>{oversize}</span>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" variant="primary" disabledReason={disabledReason}>
            New Plan
          </Button>
          <p role="status" aria-live="polite" className="text-ink-secondary type-body">
            {status}
          </p>
          {stage.kind === "upload" && !navigating && (
            <Button variant="secondary" size="md" onClick={cancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

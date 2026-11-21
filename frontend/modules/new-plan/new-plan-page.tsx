"use client";

// New Plan screen (FR-1, FR-3 to FR-7, UX-DR19, UX-DR20, AD-6): a name, three files and one
// primary New Plan button. The upload runs in two stages (upload with Cancel, then the server
// step without) and is never retried. On success the planner lands on the plan's overview.

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/common/button";
import { Icon } from "@/components/common/icons";
import { Input, InputError } from "@/components/common/input";
import { showToast } from "@/components/common/toast";
import { ApiError, internalError } from "@/lib/api/errors";
import { useSession } from "@/lib/api/session";
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
  oversizeMessage,
  progressText,
  ROLES,
  SERVER_STEP_TEXT,
  type TileState,
  totalBytes,
  validateForm,
} from "./selection";
import { type CreatedPlan, isUploadCancelled, type UploadForm, uploadPlan } from "./upload";

type Stage = { kind: "idle" } | { kind: "upload"; loaded: number; total: number } | { kind: "server" };

const NO_ERRORS: FormErrors = { name: null, files: {} };

function without<V>(record: Partial<Record<FileRole, V>>, role: FileRole): Partial<Record<FileRole, V>> {
  const copy = { ...record };
  delete copy[role];
  return copy;
}

export function NewPlanPage() {
  const router = useRouter();
  const session = useSession();
  const nameId = useId();
  const nameErrorId = useId();
  const panelId = useId();

  const [name, setName] = useState("");
  const [files, setFiles] = useState<ChosenFiles<File>>(emptyFiles);
  const [errors, setErrors] = useState<FormErrors>(NO_ERRORS);
  const [tileStates, setTileStates] = useState<Partial<Record<FileRole, TileState>>>({});
  const [panel, setPanel] = useState<PanelContent | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [navigating, setNavigating] = useState(false);
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

  const mutation = useMutation<CreatedPlan, Error, UploadForm>({
    retry: 0,
    mutationFn: (form) => {
      const abort = new AbortController();
      controller.current = abort;
      return uploadPlan(form, {
        signal: abort.signal,
        onProgress: (loaded, total) => setStage({ kind: "upload", loaded, total }),
        onServerStep: () => setStage({ kind: "server" }),
      });
    },
    onSuccess: (plan) => {
      if (unmounted.current) return;
      setNavigating(true);
      showToast(createdToast(plan.name, plan.data_as_of));
      router.push(planStepHref(plan.id, "overview"));
    },
    onError: (error) => {
      inFlight.current = false;
      setStage({ kind: "idle" });
      if (isUploadCancelled(error)) return;
      showError(error instanceof ApiError ? error : internalError());
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
  const oversize = oversizeMessage(totalBytes(files), session.data?.max_upload_bytes);
  const disabledReason = busy ? IN_FLIGHT_REASON : (oversize ?? undefined);

  function choose(role: FileRole, file: File | null) {
    setFiles((current) => ({ ...current, [role]: file }));
    setTileStates((current) => without(current, role));
    setErrors((current) => ({ ...current, files: without(current.files, role) }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || busy || oversize) return;
    setPanel(null);
    setTileStates({});
    const checked = validateForm(name, files);
    setErrors({ name: checked.name, files: checked.files });
    if (!checked.ok) return;

    const chosen = files as Record<FileRole, File>;
    inFlight.current = true;
    setStage({ kind: "upload", loaded: 0, total: totalBytes(chosen) });
    mutation.mutate({ name: name.trim(), files: chosen });
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

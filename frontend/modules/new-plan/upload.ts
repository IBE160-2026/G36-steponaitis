// POST /api/plans with XMLHttpRequest (FR-1, AD-6): only XHR reports upload progress and the
// moment the body is fully sent, which the two-stage status line needs. Never retried.

import { internalError, parseErrorBody } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

import { type FileRole, ROLES } from "./selection";

export type CreatedPlan = components["schemas"]["CreatedPlan"];

export type UploadForm = { name: string; files: Record<FileRole, Blob & { name?: string }> };

/** The part of XMLHttpRequest the upload uses, so tests can pass a fake. */
export type XhrLike = {
  open(method: string, url: string): void;
  send(body: FormData): void;
  abort(): void;
  readonly status: number;
  readonly responseText: string;
  upload: {
    onprogress: ((event: { loaded: number; total: number; lengthComputable: boolean }) => void) | null;
    onload: (() => void) | null;
  };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
  ontimeout: (() => void) | null;
};

export type UploadOptions = {
  onProgress?: (loaded: number, total: number) => void;
  onServerStep?: () => void;
  signal?: AbortSignal;
  createXhr?: () => XhrLike;
};

/** The rejection when the planner cancels the upload; it is never shown as an error. */
export class UploadCancelled extends Error {
  constructor() {
    super("The upload was cancelled.");
    this.name = "AbortError";
  }
}

export function isUploadCancelled(error: unknown): boolean {
  return error instanceof UploadCancelled;
}

export function planFormData(form: UploadForm): FormData {
  const data = new FormData();
  data.append("name", form.name);
  for (const role of ROLES) {
    const file = form.files[role];
    data.append(role, file, file.name ?? role);
  }
  return data;
}

export function uploadPlan(form: UploadForm, options: UploadOptions = {}): Promise<CreatedPlan> {
  const { onProgress, onServerStep, signal } = options;
  const createXhr = options.createXhr ?? (() => new XMLHttpRequest() as unknown as XhrLike);

  return new Promise<CreatedPlan>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadCancelled());
      return;
    }
    const xhr = createXhr();
    const onAbortSignal = () => xhr.abort();
    const done = () => signal?.removeEventListener("abort", onAbortSignal);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded, event.total);
    };
    xhr.upload.onload = () => onServerStep?.();
    xhr.onload = () => {
      done();
      if (xhr.status === 201) {
        try {
          resolve(JSON.parse(xhr.responseText) as CreatedPlan);
        } catch {
          reject(internalError(xhr.status));
        }
        return;
      }
      reject(parseErrorBody(xhr.status, xhr.responseText));
    };
    xhr.onerror = () => {
      done();
      reject(internalError());
    };
    xhr.ontimeout = xhr.onerror;
    xhr.onabort = () => {
      done();
      reject(new UploadCancelled());
    };

    signal?.addEventListener("abort", onAbortSignal, { once: true });
    xhr.open("POST", "/api/plans");
    xhr.send(planFormData(form));
  });
}

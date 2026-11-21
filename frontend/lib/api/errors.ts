// AD-11 error envelope on the client: `{error: {code, message, details}}`. The UI branches only on
// `code`; anything that is not an envelope (a proxy's HTML page, a network failure) becomes `internal`.

export type ApiErrorDetail = Record<string, unknown>;

export const INTERNAL_MESSAGE = "Something went wrong. Try again.";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The `internal` error used for every failure that carries no envelope. */
export function internalError(status = 0): ApiError {
  return new ApiError(status, "internal", INTERNAL_MESSAGE);
}

/** Read an error response body; a body that is not the AD-11 envelope becomes `internal`. */
export function parseErrorBody(status: number, text: string): ApiError {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return internalError(status);
  }
  if (!isRecord(body) || !isRecord(body.error)) return internalError(status);
  const { code, message, details } = body.error;
  if (typeof code !== "string" || code === "" || typeof message !== "string") return internalError(status);
  const list = Array.isArray(details) ? details.filter(isRecord) : [];
  return new ApiError(status, code, message, list);
}

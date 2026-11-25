// One JSON write to the API, shared by every module that changes server data outside the plan
// command flow (auth, categories). Never retried: the caller decides what a failure means.

import { internalError, parseErrorBody } from "@/lib/api/errors";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type WriteMethod = "POST" | "PATCH" | "PUT" | "DELETE";

/**
 * Sends `body` (when given) as JSON to `url` once. Resolves with the parsed answer, or `undefined`
 * for an empty body (204); rejects with the AD-11 `ApiError` (`internal` for a network failure or
 * an answer that is not JSON).
 */
export async function sendJson<T>(
  method: WriteMethod,
  url: string,
  body?: unknown,
  fetchImpl: FetchLike = fetch,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw internalError();
  }
  const text = await response.text();
  if (!response.ok) throw parseErrorBody(response.status, text);
  if (text === "") return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw internalError(response.status);
  }
}

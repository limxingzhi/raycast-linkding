import type { BookmarkPayload } from "./payload";
import type { LinkdingSettings } from "./preferences";

const REQUEST_TIMEOUT_MS = 15_000;

export type LinkdingErrorKind = "unauthorized" | "http" | "network" | "timeout";

export class LinkdingError extends Error {
  readonly kind: LinkdingErrorKind;
  readonly status?: number;

  constructor(kind: LinkdingErrorKind, message: string, status?: number) {
    super(message);
    this.name = "LinkdingError";
    this.kind = kind;
    this.status = status;
  }
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export async function createBookmark(
  payload: BookmarkPayload,
  settings: LinkdingSettings,
  fetchImpl: Fetch = fetch,
): Promise<void> {
  let response: Response;

  try {
    response = await fetchImpl(`${settings.baseUrl}/bookmarks/`, {
      method: "POST",
      headers: {
        Authorization: `Token ${settings.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new LinkdingError("timeout", "The request to linkding timed out.");
    }
    throw new LinkdingError("network", "Could not reach the linkding server.");
  }

  if (response.ok) {
    return;
  }

  if (response.status === 401) {
    throw new LinkdingError("unauthorized", "linkding rejected the API token.", 401);
  }

  throw new LinkdingError("http", await readErrorMessage(response), response.status);
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof LinkdingError && error.kind === "unauthorized";
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "An unexpected error occurred.";
}

function isTimeoutError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("name" in error)) {
    return false;
  }

  const name = (error as { name?: unknown }).name;
  return name === "TimeoutError" || name === "AbortError";
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `linkding returned ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;

  try {
    const body = await response.text();
    if (!body) {
      return fallback;
    }

    const message = extractMessage(JSON.parse(body));
    return message ?? fallback;
  } catch {
    return fallback;
  }
}

function extractMessage(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value.trim() || undefined;
  }

  if (Array.isArray(value)) {
    const messages = value.map(extractMessage).filter((message): message is string => Boolean(message));
    return messages.length > 0 ? messages.join(" ") : undefined;
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;

    for (const key of ["detail", "message", "non_field_errors"]) {
      const message = extractMessage(record[key]);
      if (message) {
        return message;
      }
    }

    const messages = Object.entries(record)
      .map(([key, entry]) => {
        const message = extractMessage(entry);
        return message ? `${key}: ${message}` : undefined;
      })
      .filter((message): message is string => Boolean(message));

    return messages.length > 0 ? messages.join("; ") : undefined;
  }

  return undefined;
}

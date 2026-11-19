const SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;
const API_SEGMENT = "api";
const BOOKMARKS_SEGMENT = "bookmarks";

export function normalizeServerUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const withScheme = SCHEME_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return "";
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "";
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[segments.length - 1] === BOOKMARKS_SEGMENT && segments[segments.length - 2] === API_SEGMENT) {
    segments.pop();
  }

  if (segments[segments.length - 1] !== API_SEGMENT) {
    segments.push(API_SEGMENT);
  }

  url.pathname = `/${segments.join("/")}`;
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/+$/, "");
}

export function withDefaultScheme(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || SCHEME_PATTERN.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function parseAbsoluteUrl(value: string): URL | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
}

export function isValidBookmarkUrl(value: string): boolean {
  return parseAbsoluteUrl(value) !== undefined;
}

function hasUrlLikeHost(value: string): boolean {
  const host = value.split(/[/?#\s]/, 1)[0]?.toLowerCase() ?? "";
  return host.includes(".") || host === "localhost" || /^localhost:\d+$/.test(host);
}

export function parseClipboardUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (!SCHEME_PATTERN.test(trimmed) && !hasUrlLikeHost(trimmed)) {
    return undefined;
  }

  return isValidBookmarkUrl(withDefaultScheme(trimmed)) ? trimmed : undefined;
}

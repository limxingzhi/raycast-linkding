const SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;

export function normalizeServerUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const withScheme = SCHEME_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`;
  const base = withScheme.replace(/\/+$/, "");

  return base.endsWith("/api") ? base : `${base}/api`;
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

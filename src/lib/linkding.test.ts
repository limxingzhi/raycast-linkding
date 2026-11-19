import { describe, expect, it, vi } from "vitest";
import { LinkdingError, createBookmark, getErrorMessage, isUnauthorized } from "./linkding";

const settings = {
  baseUrl: "https://linkding.example.com/api",
  apiToken: "secret",
  tags: [],
};

const payload = {
  url: "https://example.com/page",
  unread: true,
  tag_names: ["dev"],
};

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createBookmark", () => {
  it("posts the payload to /api/bookmarks/ with token auth", async () => {
    const fetchMock = vi.fn<Fetch>().mockResolvedValue(jsonResponse({ id: 1 }, 201));

    await createBookmark(payload, settings, fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://linkding.example.com/api/bookmarks/");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      Authorization: "Token secret",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init.body as string)).toEqual(payload);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("maps 401 to an unauthorized error", async () => {
    const fetchMock = vi.fn<Fetch>().mockResolvedValue(jsonResponse({ detail: "Invalid token." }, 401));

    const error = await createBookmark(payload, settings, fetchMock).catch((reason) => reason);

    expect(error).toBeInstanceOf(LinkdingError);
    expect(error).toMatchObject({ kind: "unauthorized", status: 401 });
    expect(isUnauthorized(error)).toBe(true);
  });

  it("maps a 404 to a readable HTTP error", async () => {
    const fetchMock = vi.fn<Fetch>().mockResolvedValue(jsonResponse({ detail: "Not found." }, 404));

    await expect(createBookmark(payload, settings, fetchMock)).rejects.toMatchObject({
      kind: "http",
      status: 404,
      message: "Not found.",
    });
  });

  it("uses the server message for a 5xx response", async () => {
    const fetchMock = vi.fn<Fetch>().mockResolvedValue(jsonResponse({ detail: "Server exploded" }, 500));

    await expect(createBookmark(payload, settings, fetchMock)).rejects.toMatchObject({
      kind: "http",
      status: 500,
      message: "Server exploded",
    });
  });

  it("falls back to the status when a 5xx response has no body", async () => {
    const fetchMock = vi.fn<Fetch>().mockResolvedValue(new Response(null, { status: 502, statusText: "Bad Gateway" }));

    await expect(createBookmark(payload, settings, fetchMock)).rejects.toMatchObject({
      kind: "http",
      message: "linkding returned 502 Bad Gateway",
    });
  });

  it("maps timeouts", async () => {
    const fetchMock = vi.fn<Fetch>().mockRejectedValue(new DOMException("Timed out", "TimeoutError"));

    await expect(createBookmark(payload, settings, fetchMock)).rejects.toMatchObject({
      kind: "timeout",
      message: "The request to linkding timed out.",
    });
  });

  it("maps network failures", async () => {
    const fetchMock = vi.fn<Fetch>().mockRejectedValue(new TypeError("fetch failed"));

    await expect(createBookmark(payload, settings, fetchMock)).rejects.toMatchObject({
      kind: "network",
      message: "Could not reach the linkding server.",
    });
  });

  it("does not report an aborted request as a timeout", async () => {
    const fetchMock = vi.fn<Fetch>().mockRejectedValue(new DOMException("Aborted", "AbortError"));

    await expect(createBookmark(payload, settings, fetchMock)).rejects.toMatchObject({
      kind: "network",
      message: "Could not reach the linkding server.",
    });
  });

  it("rejects a malformed server URL before sending a request", async () => {
    const fetchMock = vi.fn<Fetch>();

    await expect(createBookmark(payload, { ...settings, baseUrl: "" }, fetchMock)).rejects.toMatchObject({
      kind: "config",
      message: "Set a valid Server URL in the extension preferences.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores deeply nested error bodies", async () => {
    let body: unknown = "deep";
    for (let index = 0; index < 20; index += 1) {
      body = { nested: body };
    }
    const fetchMock = vi.fn<Fetch>().mockResolvedValue(jsonResponse(body, 500));

    await expect(createBookmark(payload, settings, fetchMock)).rejects.toMatchObject({
      kind: "http",
      message: "linkding returned 500",
    });
  });

  it("caps long server messages", async () => {
    const fetchMock = vi.fn<Fetch>().mockResolvedValue(jsonResponse({ detail: "x".repeat(5_000) }, 500));

    const error = await createBookmark(payload, settings, fetchMock).catch((reason) => reason);

    expect(error.message).toHaveLength(1_000);
  });
});

describe("getErrorMessage", () => {
  it("returns the error message", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
    expect(getErrorMessage("nope")).toBe("An unexpected error occurred.");
  });

  it("returns the message for a LinkdingError", () => {
    expect(getErrorMessage(new LinkdingError("http", "Server exploded"))).toBe("Server exploded");
  });
});

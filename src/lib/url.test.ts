import { describe, expect, it } from "vitest";
import { isValidBookmarkUrl, normalizeServerUrl, parseClipboardUrl, withDefaultScheme } from "./url";

describe("normalizeServerUrl", () => {
  it("trims whitespace and appends /api", () => {
    expect(normalizeServerUrl("  https://linkding.example.com  ")).toBe("https://linkding.example.com/api");
  });

  it("strips trailing slashes", () => {
    expect(normalizeServerUrl("https://linkding.example.com///")).toBe("https://linkding.example.com/api");
  });

  it("keeps a subpath", () => {
    expect(normalizeServerUrl("https://example.com/linkding/")).toBe("https://example.com/linkding/api");
  });

  it("adds a scheme when one is missing", () => {
    expect(normalizeServerUrl("linkding.example.com")).toBe("https://linkding.example.com/api");
  });

  it("keeps an explicit http scheme and port", () => {
    expect(normalizeServerUrl("http://192.168.1.10:9090")).toBe("http://192.168.1.10:9090/api");
  });

  it("does not append /api twice", () => {
    expect(normalizeServerUrl("https://linkding.example.com/api/")).toBe("https://linkding.example.com/api");
  });

  it("strips a full bookmarks API URL", () => {
    expect(normalizeServerUrl("https://linkding.example.com/api/bookmarks/")).toBe("https://linkding.example.com/api");
  });

  it("supports an instance hosted under /api", () => {
    expect(normalizeServerUrl("https://linkding.example.com/api/api/bookmarks/")).toBe(
      "https://linkding.example.com/api/api",
    );
  });

  it("drops query strings and fragments", () => {
    expect(normalizeServerUrl("https://linkding.example.com?page=2#top")).toBe("https://linkding.example.com/api");
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeServerUrl("   ")).toBe("");
  });

  it("returns an empty string for malformed input", () => {
    expect(normalizeServerUrl("https://")).toBe("");
    expect(normalizeServerUrl("not a url")).toBe("");
    expect(normalizeServerUrl("ftp://linkding.example.com")).toBe("");
  });
});

describe("withDefaultScheme", () => {
  it("adds https to scheme-less URLs", () => {
    expect(withDefaultScheme("example.com/page")).toBe("https://example.com/page");
  });

  it("keeps existing schemes, host ports, and blank input", () => {
    expect(withDefaultScheme("http://example.com")).toBe("http://example.com");
    expect(withDefaultScheme("localhost:3000/page")).toBe("https://localhost:3000/page");
    expect(withDefaultScheme("  ")).toBe("");
  });
});

describe("isValidBookmarkUrl", () => {
  it("accepts absolute http and https URLs", () => {
    expect(isValidBookmarkUrl("https://example.com/page?q=1")).toBe(true);
    expect(isValidBookmarkUrl("http://example.com")).toBe(true);
  });

  it("rejects blank and relative URLs", () => {
    expect(isValidBookmarkUrl("")).toBe(false);
    expect(isValidBookmarkUrl("   ")).toBe(false);
    expect(isValidBookmarkUrl("/page")).toBe(false);
    expect(isValidBookmarkUrl("example.com")).toBe(false);
  });

  it("rejects non-http schemes", () => {
    expect(isValidBookmarkUrl("ftp://example.com/file")).toBe(false);
  });
});

describe("parseClipboardUrl", () => {
  it("trims whitespace from absolute URLs", () => {
    expect(parseClipboardUrl("  https://example.com/page  ")).toBe("https://example.com/page");
  });

  it("accepts scheme-less URLs that look like hosts", () => {
    expect(parseClipboardUrl("example.com/page")).toBe("example.com/page");
    expect(parseClipboardUrl("localhost:3000/page")).toBe("localhost:3000/page");
  });

  it("rejects blank text, plain words, and non-http values", () => {
    expect(parseClipboardUrl("")).toBeUndefined();
    expect(parseClipboardUrl("   ")).toBeUndefined();
    expect(parseClipboardUrl("hello")).toBeUndefined();
    expect(parseClipboardUrl("just some text")).toBeUndefined();
    expect(parseClipboardUrl("ftp://example.com/file")).toBeUndefined();
  });
});

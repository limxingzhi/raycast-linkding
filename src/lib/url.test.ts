import { describe, expect, it } from "vitest";
import { isValidBookmarkUrl, normalizeServerUrl } from "./url";

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

  it("returns an empty string for blank input", () => {
    expect(normalizeServerUrl("   ")).toBe("");
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

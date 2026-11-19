import { describe, expect, it } from "vitest";
import { buildBookmarkPayload, validateBookmarkUrl } from "./payload";

describe("buildBookmarkPayload", () => {
  it("maps unread form state to the API payload", () => {
    expect(
      buildBookmarkPayload({
        url: " https://example.com/page ",
        read: false,
        tags: ["dev", "reading"],
      }),
    ).toEqual({
      url: "https://example.com/page",
      unread: true,
      tag_names: ["dev", "reading"],
    });
  });

  it("maps read form state to unread false", () => {
    expect(
      buildBookmarkPayload({
        url: "https://example.com",
        read: true,
        tags: [],
      }),
    ).toEqual({
      url: "https://example.com",
      unread: false,
      tag_names: [],
    });
  });

  it("throws a readable message instead of a ZodError", () => {
    expect(() =>
      buildBookmarkPayload({
        url: "not a url",
        read: false,
        tags: [],
      }),
    ).toThrow("Enter a valid http or https URL");
  });
});

describe("validateBookmarkUrl", () => {
  it("reports a missing URL", () => {
    expect(validateBookmarkUrl("   ")).toBe("Enter a URL");
  });

  it("reports a relative URL", () => {
    expect(validateBookmarkUrl("/page")).toBe("Enter a valid http or https URL");
  });

  it("accepts an absolute URL", () => {
    expect(validateBookmarkUrl("https://example.com/page")).toBeUndefined();
  });
});

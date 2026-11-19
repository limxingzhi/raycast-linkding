import { describe, expect, it } from "vitest";
import { parseTagList } from "./tags";

describe("parseTagList", () => {
  it("trims, drops blanks, and dedupes", () => {
    expect(parseTagList(" a, b,,a ")).toEqual(["a", "b"]);
  });

  it("returns an empty list for an empty preference", () => {
    expect(parseTagList("")).toEqual([]);
    expect(parseTagList(undefined)).toEqual([]);
    expect(parseTagList(null)).toEqual([]);
  });

  it("keeps the first spelling of a repeated tag", () => {
    expect(parseTagList("dev, Dev, reading")).toEqual(["dev", "reading"]);
  });
});

import { describe, expect, it } from "vitest";
import { parseTagList, retainConfiguredTags } from "./tags";

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

describe("retainConfiguredTags", () => {
  it("drops tags that are no longer configured", () => {
    expect(retainConfiguredTags(["dev", "retired"], ["dev", "reading"])).toEqual(["dev"]);
  });

  it("uses the configured spelling and drops duplicates", () => {
    expect(retainConfiguredTags(["DEV", "dev", "Reading"], ["dev", "reading"])).toEqual(["dev", "reading"]);
  });

  it("returns an empty list when nothing is configured", () => {
    expect(retainConfiguredTags(["dev"], [])).toEqual([]);
  });
});

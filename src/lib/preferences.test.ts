import { getPreferenceValues } from "@raycast/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSettings, resolveSettings } from "./preferences";

const getPreferenceValuesMock = vi.mocked(getPreferenceValues);

beforeEach(() => {
  getPreferenceValuesMock.mockReset();
});

describe("resolveSettings", () => {
  it("normalizes the server URL and parses tags", () => {
    expect(
      resolveSettings({
        serverUrl: " https://linkding.example.com/ ",
        apiToken: "secret",
        tags: " a, b,,a ",
      }),
    ).toEqual({
      baseUrl: "https://linkding.example.com/api",
      apiToken: "secret",
      tags: ["a", "b"],
    });
  });

  it("uses an empty tag list when the preference is missing", () => {
    expect(
      resolveSettings({
        serverUrl: "https://linkding.example.com",
        apiToken: "secret",
      }),
    ).toEqual({
      baseUrl: "https://linkding.example.com/api",
      apiToken: "secret",
      tags: [],
    });
  });
});

describe("getSettings", () => {
  it("reads values from Raycast preferences", () => {
    getPreferenceValuesMock.mockReturnValue({
      serverUrl: "https://linkding.example.com/",
      apiToken: "secret",
      tags: "dev, reading",
    });

    expect(getSettings()).toEqual({
      baseUrl: "https://linkding.example.com/api",
      apiToken: "secret",
      tags: ["dev", "reading"],
    });
  });
});

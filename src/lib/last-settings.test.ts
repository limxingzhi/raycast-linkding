import { LocalStorage } from "@raycast/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetLocalStorage } from "../../test/raycast-api-mock";
import { EMPTY_LAST_SETTINGS, loadLastSettings, saveLastSettings } from "./last-settings";

const getItemMock = vi.mocked(LocalStorage.getItem);
const setItemMock = vi.mocked(LocalStorage.setItem);

beforeEach(() => {
  resetLocalStorage();
  getItemMock.mockClear();
  setItemMock.mockClear();
});

describe("last settings", () => {
  it("returns the empty settings when nothing was saved", async () => {
    await expect(loadLastSettings()).resolves.toEqual(EMPTY_LAST_SETTINGS);
  });

  it("round-trips the read status and tags", async () => {
    await saveLastSettings({ read: true, tags: ["dev", "reading"] });

    await expect(loadLastSettings()).resolves.toEqual({ read: true, tags: ["dev", "reading"] });
  });

  it("falls back when the stored value is not JSON", async () => {
    await LocalStorage.setItem("last-bookmark-settings", "not json");

    await expect(loadLastSettings()).resolves.toEqual(EMPTY_LAST_SETTINGS);
  });

  it("falls back when the stored value has the wrong shape", async () => {
    await LocalStorage.setItem("last-bookmark-settings", JSON.stringify({ read: "yes", tags: "dev" }));

    await expect(loadLastSettings()).resolves.toEqual(EMPTY_LAST_SETTINGS);
  });

  it("falls back when reading storage fails", async () => {
    getItemMock.mockRejectedValueOnce(new Error("Storage unavailable"));

    await expect(loadLastSettings()).resolves.toEqual(EMPTY_LAST_SETTINGS);
  });

  it("ignores a failure to write the settings", async () => {
    setItemMock.mockRejectedValueOnce(new Error("Storage unavailable"));

    await expect(saveLastSettings({ read: false, tags: [] })).resolves.toBeUndefined();
  });
});

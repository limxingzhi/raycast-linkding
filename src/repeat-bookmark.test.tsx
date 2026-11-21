import { Action, Clipboard, Form, LaunchType, LocalStorage, getPreferenceValues } from "@raycast/api";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { focusLog, resetFocusLog, resetLocalStorage } from "../test/raycast-api-mock";
import { saveLastSettings } from "./lib/last-settings";
import type { BookmarkDraftValues } from "./bookmark-form";
import RepeatBookmarkCommand from "./repeat-bookmark";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getPreferenceValuesMock = vi.mocked(getPreferenceValues);
const setItemMock = vi.mocked(LocalStorage.setItem);

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

async function renderCommand(clipboardText?: string, draftValues?: BookmarkDraftValues): Promise<ReactTestRenderer> {
  if (clipboardText !== undefined) {
    vi.mocked(Clipboard.readText).mockResolvedValueOnce(clipboardText);
  }

  let renderer: ReactTestRenderer | undefined;

  await act(async () => {
    renderer = create(
      <RepeatBookmarkCommand launchType={LaunchType.UserInitiated} arguments={{}} draftValues={draftValues} />,
    );
  });

  return renderer as ReactTestRenderer;
}

beforeEach(() => {
  resetLocalStorage();
  resetFocusLog();
  getPreferenceValuesMock.mockReturnValue({
    serverUrl: "https://linkding.example.com",
    apiToken: "secret",
    tags: "dev, reading",
  });
  vi.mocked(Clipboard.readText).mockReset();
  vi.mocked(Clipboard.readText).mockResolvedValue("");
  setItemMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Repeat Bookmark", () => {
  it("prefills the tags and read status from the last save", async () => {
    await saveLastSettings({ read: true, tags: ["dev"] });

    const renderer = await renderCommand("https://example.com/next");

    expect(renderer.root.findByType(Form.TextField).props.value).toBe("https://example.com/next");
    expect(renderer.root.findByType(Form.TagPicker).props.value).toEqual(["dev"]);
    expect(renderer.root.findByType(Form.Checkbox).props.value).toBe(true);
  });

  it("takes the URL from the clipboard, not the previous save", async () => {
    await saveLastSettings({ read: false, tags: ["dev"] });

    const renderer = await renderCommand("https://example.com/new-page");

    expect(renderer.root.findByType(Form.TextField).props.value).toBe("https://example.com/new-page");
    expect(focusLog).toEqual(["Form.TagPicker"]);
  });

  it("drops remembered tags that are no longer configured", async () => {
    await saveLastSettings({ read: false, tags: ["dev", "retired"] });

    const renderer = await renderCommand();

    expect(renderer.root.findByType(Form.TagPicker).props.value).toEqual(["dev"]);
  });

  it("uses the configured spelling of a remembered tag", async () => {
    await saveLastSettings({ read: false, tags: ["DEV"] });

    const renderer = await renderCommand();

    expect(renderer.root.findByType(Form.TagPicker).props.value).toEqual(["dev"]);
  });

  it("opens from a saved draft instead of the last settings", async () => {
    await saveLastSettings({ read: false, tags: ["dev"] });

    const renderer = await renderCommand("https://example.com/clipboard", {
      url: "https://example.com/draft",
      tags: ["reading"],
      read: true,
    });

    expect(renderer.root.findByType(Form).props.enableDrafts).toBe(true);
    expect(renderer.root.findByType(Form.TextField).props.value).toBe("https://example.com/draft");
    expect(renderer.root.findByType(Form.TagPicker).props.value).toEqual(["reading"]);
    expect(renderer.root.findByType(Form.Checkbox).props.value).toBe(true);
    expect(focusLog).toEqual([]);
  });

  it("starts empty and unread without a previous save", async () => {
    const renderer = await renderCommand();

    expect(renderer.root.findByType(Form.TextField).props.value).toBe("");
    expect(renderer.root.findByType(Form.TextField).props.autoFocus).toBe(true);
    expect(focusLog).toEqual([]);
    expect(renderer.root.findByType(Form.TagPicker).props.value).toEqual([]);
    expect(renderer.root.findByType(Form.Checkbox).props.value).toBe(false);
  });

  it("starts empty and unread when the stored settings are unreadable", async () => {
    await LocalStorage.setItem("last-bookmark-settings", "{oops");

    const renderer = await renderCommand();

    expect(renderer.root.findByType(Form.TagPicker).props.value).toEqual([]);
    expect(renderer.root.findByType(Form.Checkbox).props.value).toBe(false);
  });

  it("prefills the clipboard URL before the last settings resolve", async () => {
    let resolveStorage!: (value: string | undefined) => void;
    vi.mocked(LocalStorage.getItem).mockReturnValueOnce(
      new Promise<string | undefined>((resolve) => {
        resolveStorage = resolve;
      }) as Promise<string>,
    );

    const renderer = await renderCommand("https://example.com/page");

    expect(renderer.root.findByType(Form).props.isLoading).toBeUndefined();
    expect(renderer.root.findByType(Form.TextField).props.value).toBe("https://example.com/page");
    expect(renderer.root.findByType(Form.Checkbox).props.value).toBe(false);
    expect(focusLog).toEqual(["Form.TagPicker"]);

    await act(async () => {
      resolveStorage(JSON.stringify({ read: true, tags: ["dev"] }));
      await Promise.resolve();
    });

    expect(renderer.root.findByType(Form.Checkbox).props.value).toBe(true);
    expect(renderer.root.findByType(Form.TagPicker).props.value).toEqual(["dev"]);
  });

  it("does not overwrite edits with settings that resolve later", async () => {
    let resolveStorage!: (value: string | undefined) => void;
    vi.mocked(LocalStorage.getItem).mockReturnValueOnce(
      new Promise<string | undefined>((resolve) => {
        resolveStorage = resolve;
      }) as Promise<string>,
    );

    const renderer = await renderCommand();

    await act(async () => {
      renderer.root.findByType(Form.TagPicker).props.onChange(["reading"]);
      renderer.root.findByType(Form.Checkbox).props.onChange(true);
    });

    await act(async () => {
      resolveStorage(JSON.stringify({ read: false, tags: ["dev"] }));
      await Promise.resolve();
    });

    expect(renderer.root.findByType(Form.TagPicker).props.value).toEqual(["reading"]);
    expect(renderer.root.findByType(Form.Checkbox).props.value).toBe(true);
  });

  it("remembers what was saved for the next run", async () => {
    const fetchMock = vi.fn<Fetch>(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const renderer = await renderCommand("https://example.com/page");
    const tagPicker = renderer.root.findByType(Form.TagPicker);
    const checkbox = renderer.root.findByType(Form.Checkbox);

    await act(async () => {
      tagPicker.props.onChange(["reading"]);
      checkbox.props.onChange(true);
    });

    const submitAction = renderer.root.findByType(Action.SubmitForm);
    await act(async () => {
      await (submitAction.props.onSubmit as () => Promise<void>)();
    });

    expect(setItemMock).toHaveBeenCalledWith(
      "last-bookmark-settings",
      JSON.stringify({ read: true, tags: ["reading"] }),
    );
  });
});

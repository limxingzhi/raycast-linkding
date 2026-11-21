import {
  Action,
  ActionPanel,
  Clipboard,
  Form,
  LaunchType,
  LocalStorage,
  Toast,
  closeMainWindow,
  getPreferenceValues,
  openExtensionPreferences,
  showToast,
} from "@raycast/api";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { focusLog, hideToast, resetFocusLog, resetLocalStorage } from "../test/raycast-api-mock";
import AddBookmarkCommand from "./add-bookmark";
import type { BookmarkDraftValues } from "./bookmark-form";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getPreferenceValuesMock = vi.mocked(getPreferenceValues);
const showToastMock = vi.mocked(showToast);

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

async function renderCommand(clipboardText?: string, draftValues?: BookmarkDraftValues): Promise<ReactTestRenderer> {
  if (clipboardText !== undefined) {
    vi.mocked(Clipboard.readText).mockResolvedValueOnce(clipboardText);
  }

  let renderer: ReactTestRenderer | undefined;

  await act(async () => {
    renderer = create(
      <AddBookmarkCommand launchType={LaunchType.UserInitiated} arguments={{}} draftValues={draftValues} />,
    );
  });

  return renderer as ReactTestRenderer;
}

async function submit(renderer: ReactTestRenderer): Promise<void> {
  const action = renderer.root.findByType(Action.SubmitForm);
  await act(async () => {
    await (action.props.onSubmit as () => Promise<void>)();
  });
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
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Add Bookmark", () => {
  it("opens an empty URL field when the clipboard has no URL", async () => {
    const renderer = await renderCommand();

    expect(renderer.root.findByType(Form.TextField).props.value).toBe("");
  });

  it("focuses the URL field through autoFocus when the clipboard has no URL", async () => {
    const renderer = await renderCommand();

    expect(renderer.root.findByType(Form.TextField).props.autoFocus).toBe(true);
    expect(focusLog).toEqual([]);
  });

  it("prefills the URL from the clipboard", async () => {
    vi.mocked(Clipboard.readText).mockResolvedValueOnce("  https://example.com/from-clipboard  ");

    const renderer = await renderCommand();

    expect(renderer.root.findByType(Form.TextField).props.value).toBe("https://example.com/from-clipboard");
    expect(renderer.root.findByType(Form.TextField).props.autoFocus).toBe(true);
    expect(focusLog).toEqual(["Form.TagPicker"]);
  });

  it("opens from a saved draft instead of the clipboard", async () => {
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

  it("still prefills when the launch passes an empty draft object", async () => {
    const renderer = await renderCommand("https://example.com/from-clipboard", {});

    expect(renderer.root.findByType(Form.TextField).props.value).toBe("https://example.com/from-clipboard");
    expect(focusLog).toEqual(["Form.TagPicker"]);
  });

  it("ignores clipboard text that is not a URL", async () => {
    vi.mocked(Clipboard.readText).mockResolvedValueOnce("just some text");

    const renderer = await renderCommand();

    expect(renderer.root.findByType(Form.TextField).props.value).toBe("");
    expect(focusLog).toEqual([]);
  });

  it("opens an interactive form while the clipboard resolves", async () => {
    let resolveClipboard!: (text: string) => void;
    vi.mocked(Clipboard.readText).mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveClipboard = resolve;
      }),
    );

    const renderer = await renderCommand();

    expect(renderer.root.findByType(Form).props.isLoading).toBeUndefined();
    expect(renderer.root.findByType(Form.TextField).props.value).toBe("");
    expect(renderer.root.findByType(Form.TextField).props.autoFocus).toBe(true);
    expect(focusLog).toEqual([]);

    await act(async () => {
      resolveClipboard("https://example.com/from-clipboard");
      await Promise.resolve();
    });

    expect(renderer.root.findByType(Form.TextField).props.value).toBe("https://example.com/from-clipboard");
    expect(focusLog).toEqual(["Form.TagPicker"]);
  });

  it("opens an empty form when the clipboard cannot be read", async () => {
    vi.mocked(Clipboard.readText).mockRejectedValueOnce(new Error("Clipboard unavailable"));

    const renderer = await renderCommand();

    expect(renderer.root.findByType(Form.TextField).props.value).toBe("");
    expect(focusLog).toEqual([]);
  });

  it("places read status after URL and tags", async () => {
    const renderer = await renderCommand();
    const children = (renderer.root.findByType(Form).props.children as Array<{ type: unknown } | null>).filter(
      (child): child is { type: unknown } => child !== null,
    );

    expect(children.map((child) => child.type)).toEqual([Form.TextField, Form.TagPicker, Form.Checkbox]);
  });

  it("toggles read status with the CMD+R shortcut", async () => {
    const renderer = await renderCommand();
    const toggle = renderer.root
      .findAllByType(Action)
      .find((action) => action.props.shortcut?.key === "r" && action.props.shortcut?.modifiers?.includes("cmd"));

    expect(toggle?.props.shortcut).toEqual({ modifiers: ["cmd"], key: "r" });
    expect(renderer.root.findByType(Form.Checkbox).props.value).toBe(false);

    await act(async () => {
      toggle?.props.onAction();
    });

    expect(renderer.root.findByType(Form.Checkbox).props.value).toBe(true);
    expect(renderer.root.findAllByType(Action).find((action) => action.props.shortcut?.key === "r")?.props.title).toBe(
      "Mark as Unread",
    );
  });

  it("saves an unread bookmark and closes the command", async () => {
    const fetchMock = vi.fn<Fetch>(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const renderer = await renderCommand("https://example.com/page");
    await submit(renderer);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://linkding.example.com/api/bookmarks/",
      expect.objectContaining({ method: "POST" }),
    );
    const init = fetchMock.mock.calls[0][1];
    expect(JSON.parse(init.body as string)).toEqual({
      url: "https://example.com/page",
      unread: true,
      tag_names: [],
    });
    expect(showToastMock).toHaveBeenCalledWith({ style: Toast.Style.Animated, title: "Saving bookmark" });
    expect(hideToast).toHaveBeenCalled();
    expect(closeMainWindow).toHaveBeenCalled();
    expect(LocalStorage.setItem).toHaveBeenCalledWith(
      "last-bookmark-settings",
      JSON.stringify({ read: false, tags: [] }),
    );
  });

  it("remembers the tags and read status after a successful save", async () => {
    const fetchMock = vi.fn<Fetch>(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const renderer = await renderCommand("https://example.com/page");
    await act(async () => {
      renderer.root.findByType(Form.Checkbox).props.onChange(true);
      renderer.root.findByType(Form.TagPicker).props.onChange(["dev"]);
    });

    await submit(renderer);

    expect(LocalStorage.setItem).toHaveBeenCalledWith(
      "last-bookmark-settings",
      JSON.stringify({ read: true, tags: ["dev"] }),
    );
  });

  it("keeps the previous settings when a save fails", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ detail: "Server exploded" }), { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const renderer = await renderCommand("https://example.com/page");
    await act(async () => {
      renderer.root.findByType(Form.Checkbox).props.onChange(true);
    });

    await submit(renderer);

    expect(LocalStorage.setItem).not.toHaveBeenCalled();
  });

  it("submits read status and selected tags", async () => {
    const fetchMock = vi.fn<Fetch>(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const renderer = await renderCommand("https://example.com/page");
    const checkbox = renderer.root.findByType(Form.Checkbox);
    const tagPicker = renderer.root.findByType(Form.TagPicker);

    await act(async () => {
      checkbox.props.onChange(true);
      tagPicker.props.onChange(["dev"]);
    });

    await submit(renderer);

    const init = fetchMock.mock.calls[0][1];
    expect(JSON.parse(init.body as string)).toEqual({
      url: "https://example.com/page",
      unread: false,
      tag_names: ["dev"],
    });
  });

  it("shows a field error for an invalid URL", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const renderer = await renderCommand();
    await act(async () => {
      renderer.root.findByType(Form.TextField).props.onChange("not a url");
    });
    await submit(renderer);

    expect(renderer.root.findByType(Form.TextField).props.error).toBe("Enter a valid http or https URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows an animated loader toast while saving", async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn<Fetch>(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const renderer = await renderCommand("https://example.com/page");
    const action = renderer.root.findByType(Action.SubmitForm);
    let firstSubmit!: Promise<void>;

    await act(async () => {
      firstSubmit = (action.props.onSubmit as () => Promise<void>)();
    });

    expect(showToastMock).toHaveBeenCalledWith({ style: Toast.Style.Animated, title: "Saving bookmark" });
    expect(hideToast).not.toHaveBeenCalled();

    await act(async () => {
      resolveFetch(new Response("{}", { status: 201 }));
      await firstSubmit;
    });

    expect(hideToast).toHaveBeenCalled();
  });

  it("shows a single failure toast on a token error", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ detail: "Invalid token." }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const renderer = await renderCommand("https://example.com/page");
    await submit(renderer);

    expect(renderer.root.findAllByType(Form.Description)).toHaveLength(0);
    expect(showToastMock).toHaveBeenCalledTimes(1);
    expect(showToastMock).toHaveBeenCalledWith({ style: Toast.Style.Animated, title: "Saving bookmark" });

    const toast = (await showToastMock.mock.results[0]!.value) as Toast;
    expect(toast.style).toBe(Toast.Style.Failure);
    expect(toast.title).toBe("Invalid API token");
    expect(toast.message).toBe("Update the token in the extension preferences.");
    expect(toast.primaryAction?.title).toBe("Open Extension Preferences");
    toast.primaryAction?.onAction(toast);
    expect(openExtensionPreferences).toHaveBeenCalled();

    const actionTitles = renderer.root.findAllByType(Action).map((action) => action.props.title);
    expect(actionTitles[0]).toBe("Open Extension Preferences");
    expect(renderer.root.findByType(Action.SubmitForm)).toBeTruthy();
    expect(renderer.root.findByType(ActionPanel)).toBeTruthy();
  });

  it("shows the server message in the failure toast", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ detail: "Server exploded" }), { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const renderer = await renderCommand("https://example.com/page");
    await submit(renderer);

    expect(renderer.root.findAllByType(Form.Description)).toHaveLength(0);
    expect(showToastMock).toHaveBeenCalledTimes(1);

    const toast = (await showToastMock.mock.results[0]!.value) as Toast;
    expect(toast.style).toBe(Toast.Style.Failure);
    expect(toast.title).toBe("Could not save bookmark");
    expect(toast.message).toBe("Server exploded");
  });

  it("shows a timeout message in the failure toast", async () => {
    const fetchMock = vi.fn<Fetch>().mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
    vi.stubGlobal("fetch", fetchMock);

    const renderer = await renderCommand("https://example.com/page");
    await submit(renderer);

    expect(showToastMock).toHaveBeenCalledTimes(1);

    const toast = (await showToastMock.mock.results[0]!.value) as Toast;
    expect(toast.style).toBe(Toast.Style.Failure);
    expect(toast.title).toBe("Could not save bookmark");
    expect(toast.message).toBe("The request to linkding timed out.");
  });

  it("shows a network message in the failure toast", async () => {
    const fetchMock = vi.fn<Fetch>().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    const renderer = await renderCommand("https://example.com/page");
    await submit(renderer);

    expect(showToastMock).toHaveBeenCalledTimes(1);

    const toast = (await showToastMock.mock.results[0]!.value) as Toast;
    expect(toast.style).toBe(Toast.Style.Failure);
    expect(toast.title).toBe("Could not save bookmark");
    expect(toast.message).toBe("Could not reach the linkding server.");
  });

  it("restores the normal action order after editing", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ detail: "Invalid token." }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const renderer = await renderCommand("https://example.com/page");
    await submit(renderer);
    expect(renderer.root.findAllByType(Action)[0]?.props.title).toBe("Open Extension Preferences");

    await act(async () => {
      renderer.root.findByType(Form.TextField).props.onChange("https://example.com/other");
    });

    expect(renderer.root.findAllByType(Action).map((action) => action.props.title)).toEqual([
      "Mark as Read",
      "Open Extension Preferences",
    ]);
  });

  it("ignores repeated submits while a request is in flight", async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn<Fetch>(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const renderer = await renderCommand("https://example.com/page");
    const action = renderer.root.findByType(Action.SubmitForm);
    let firstSubmit!: Promise<void>;

    await act(async () => {
      firstSubmit = (action.props.onSubmit as () => Promise<void>)();
    });

    await submit(renderer);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(showToastMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch(new Response("{}", { status: 201 }));
      await firstSubmit;
    });

    expect(closeMainWindow).toHaveBeenCalledTimes(1);
  });

  it("keeps accepting edits while a request is in flight", async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn<Fetch>(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const renderer = await renderCommand("https://example.com/page");
    const action = renderer.root.findByType(Action.SubmitForm);
    let firstSubmit!: Promise<void>;

    await act(async () => {
      firstSubmit = (action.props.onSubmit as () => Promise<void>)();
    });

    expect(showToastMock).toHaveBeenCalledWith({ style: Toast.Style.Animated, title: "Saving bookmark" });

    await act(async () => {
      renderer.root.findByType(Form.TextField).props.onChange("https://example.com/other");
      renderer.root.findByType(Form.TagPicker).props.onChange(["dev"]);
      renderer.root.findByType(Form.Checkbox).props.onChange(true);
    });

    expect(renderer.root.findByType(Form.TextField).props.value).toBe("https://example.com/other");
    expect(renderer.root.findByType(Form.TagPicker).props.value).toEqual(["dev"]);
    expect(renderer.root.findByType(Form.Checkbox).props.value).toBe(true);

    await act(async () => {
      resolveFetch(new Response("{}", { status: 201 }));
      await firstSubmit;
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      url: "https://example.com/page",
      unread: true,
      tag_names: [],
    });
  });

  it("clears the URL error when the input becomes valid", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const renderer = await renderCommand();
    await act(async () => {
      renderer.root.findByType(Form.TextField).props.onChange("not a url");
    });
    await submit(renderer);
    expect(renderer.root.findByType(Form.TextField).props.error).toBe("Enter a valid http or https URL");

    await act(async () => {
      renderer.root.findByType(Form.TextField).props.onChange("https://example.com");
    });

    expect(renderer.root.findByType(Form.TextField).props.error).toBeUndefined();
  });

  it("adds https to a scheme-less URL before saving", async () => {
    const fetchMock = vi.fn<Fetch>(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const renderer = await renderCommand("example.com/page");
    await submit(renderer);

    const init = fetchMock.mock.calls[0][1];
    expect(JSON.parse(init.body as string)).toMatchObject({ url: "https://example.com/page" });
  });

  it("reads preferences once per mount", async () => {
    const renderer = await renderCommand();

    expect(getPreferenceValuesMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer.root.findByType(Form.TextField).props.onChange("https://example.com");
    });

    expect(getPreferenceValuesMock).toHaveBeenCalledTimes(1);
  });
});

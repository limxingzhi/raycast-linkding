import {
  Action,
  Clipboard,
  Form,
  LocalStorage,
  Toast,
  closeMainWindow,
  getPreferenceValues,
  openExtensionPreferences,
  showToast,
} from "@raycast/api";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetLocalStorage } from "../test/raycast-api-mock";
import AddBookmarkCommand from "./add-bookmark";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getPreferenceValuesMock = vi.mocked(getPreferenceValues);
const showToastMock = vi.mocked(showToast);

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

async function renderCommand(clipboardText?: string): Promise<ReactTestRenderer> {
  if (clipboardText !== undefined) {
    vi.mocked(Clipboard.readText).mockResolvedValueOnce(clipboardText);
  }

  let renderer: ReactTestRenderer | undefined;

  await act(async () => {
    renderer = create(<AddBookmarkCommand />);
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

  it("focuses the URL field when the clipboard has no URL", async () => {
    const renderer = await renderCommand();

    expect(renderer.root.findByType(Form.TextField).props.autoFocus).toBe(true);
    expect(renderer.root.findByType(Form.TagPicker).props.autoFocus).toBe(false);
  });

  it("prefills the URL from the clipboard", async () => {
    vi.mocked(Clipboard.readText).mockResolvedValueOnce("  https://example.com/from-clipboard  ");

    const renderer = await renderCommand();

    expect(renderer.root.findByType(Form.TextField).props.value).toBe("https://example.com/from-clipboard");
    expect(renderer.root.findByType(Form.TextField).props.autoFocus).toBe(false);
    expect(renderer.root.findByType(Form.TagPicker).props.autoFocus).toBe(true);
  });

  it("ignores clipboard text that is not a URL", async () => {
    vi.mocked(Clipboard.readText).mockResolvedValueOnce("just some text");

    const renderer = await renderCommand();

    expect(renderer.root.findByType(Form.TextField).props.value).toBe("");
    expect(renderer.root.findByType(Form.TextField).props.autoFocus).toBe(true);
  });

  it("shows a loading form until the clipboard resolves", async () => {
    let resolveClipboard!: (text: string) => void;
    vi.mocked(Clipboard.readText).mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveClipboard = resolve;
      }),
    );

    const renderer = await renderCommand();

    expect(renderer.root.findByType(Form).props.isLoading).toBe(true);
    expect(renderer.root.findAllByType(Form.TextField)).toHaveLength(0);

    await act(async () => {
      resolveClipboard("https://example.com/from-clipboard");
      await Promise.resolve();
    });

    expect(renderer.root.findByType(Form.TextField).props.value).toBe("https://example.com/from-clipboard");
    expect(renderer.root.findByType(Form.TagPicker).props.autoFocus).toBe(true);
  });

  it("opens an empty form when the clipboard cannot be read", async () => {
    vi.mocked(Clipboard.readText).mockRejectedValueOnce(new Error("Clipboard unavailable"));

    const renderer = await renderCommand();

    expect(renderer.root.findByType(Form.TextField).props.value).toBe("");
    expect(renderer.root.findByType(Form.TextField).props.autoFocus).toBe(true);
  });

  it("places read status after URL and tags", async () => {
    const renderer = await renderCommand();
    const children = renderer.root.findByType(Form).props.children as Array<{ type: unknown }>;

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
    expect(showToastMock).toHaveBeenCalledWith({
      style: Toast.Style.Success,
      title: "Bookmark saved",
    });
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

  it("offers preferences when the token is rejected", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ detail: "Invalid token." }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const renderer = await renderCommand("https://example.com/page");
    await submit(renderer);

    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        style: Toast.Style.Failure,
        title: "Invalid API token",
        primaryAction: expect.objectContaining({ title: "Open Extension Preferences" }),
      }),
    );

    const toastOptions = showToastMock.mock.calls[0][0] as unknown as {
      primaryAction?: { onAction: () => Promise<void> };
    };
    await toastOptions.primaryAction?.onAction();
    expect(openExtensionPreferences).toHaveBeenCalled();
  });

  it("shows the server message when saving fails", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ detail: "Server exploded" }), { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const renderer = await renderCommand("https://example.com/page");
    await submit(renderer);

    expect(showToastMock).toHaveBeenCalledWith({
      style: Toast.Style.Failure,
      title: "Could not save bookmark",
      message: "Server exploded",
    });
  });

  it("shows a timeout toast when the request times out", async () => {
    const fetchMock = vi.fn<Fetch>().mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
    vi.stubGlobal("fetch", fetchMock);

    const renderer = await renderCommand("https://example.com/page");
    await submit(renderer);

    expect(showToastMock).toHaveBeenCalledWith({
      style: Toast.Style.Failure,
      title: "Could not save bookmark",
      message: "The request to linkding timed out.",
    });
  });

  it("shows a network toast when the server is unreachable", async () => {
    const fetchMock = vi.fn<Fetch>().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    const renderer = await renderCommand("https://example.com/page");
    await submit(renderer);

    expect(showToastMock).toHaveBeenCalledWith({
      style: Toast.Style.Failure,
      title: "Could not save bookmark",
      message: "Could not reach the linkding server.",
    });
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

    await act(async () => {
      resolveFetch(new Response("{}", { status: 201 }));
      await firstSubmit;
    });

    expect(showToastMock).toHaveBeenCalledTimes(1);
  });

  it("freezes the form while a request is in flight", async () => {
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

    expect(renderer.root.findByType(Form).props.isLoading).toBe(true);

    await act(async () => {
      renderer.root.findByType(Form.TextField).props.onChange("https://example.com/other");
      renderer.root.findByType(Form.TagPicker).props.onChange(["dev"]);
      renderer.root.findByType(Form.Checkbox).props.onChange(true);
    });

    expect(renderer.root.findByType(Form.TextField).props.value).toBe("https://example.com/page");
    expect(renderer.root.findByType(Form.TagPicker).props.value).toEqual([]);
    expect(renderer.root.findByType(Form.Checkbox).props.value).toBe(false);

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

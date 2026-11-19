import {
  Action,
  Form,
  Toast,
  closeMainWindow,
  getPreferenceValues,
  openExtensionPreferences,
  showToast,
} from "@raycast/api";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AddBookmarkCommand from "./add-bookmark";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getPreferenceValuesMock = vi.mocked(getPreferenceValues);
const showToastMock = vi.mocked(showToast);

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

function commandProps(link?: string): React.ComponentProps<typeof AddBookmarkCommand> {
  return {
    arguments: link === undefined ? {} : { link },
  } as unknown as React.ComponentProps<typeof AddBookmarkCommand>;
}

async function renderCommand(link?: string): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer | undefined;

  await act(async () => {
    renderer = create(<AddBookmarkCommand {...commandProps(link)} />);
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
  getPreferenceValuesMock.mockReturnValue({
    serverUrl: "https://linkding.example.com",
    apiToken: "secret",
    tags: "dev, reading",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Add Bookmark", () => {
  it("prefills the URL argument", async () => {
    const renderer = await renderCommand("https://example.com/page");

    expect(renderer.root.findByType(Form.TextField).props.value).toBe("https://example.com/page");
  });

  it("opens an empty URL field without an argument", async () => {
    const renderer = await renderCommand();

    expect(renderer.root.findByType(Form.TextField).props.value).toBe("");
  });

  it("focuses the URL field when launched without a link", async () => {
    const renderer = await renderCommand();

    expect(renderer.root.findByType(Form.TextField).props.autoFocus).toBe(true);
    expect(renderer.root.findByType(Form.TagPicker).props.autoFocus).toBe(false);
  });

  it("focuses the tag picker when launched with a link", async () => {
    const renderer = await renderCommand("https://example.com/page");

    expect(renderer.root.findByType(Form.TextField).props.autoFocus).toBe(false);
    expect(renderer.root.findByType(Form.TagPicker).props.autoFocus).toBe(true);
  });

  it("treats a blank link argument as missing", async () => {
    const renderer = await renderCommand("   ");

    expect(renderer.root.findByType(Form.TextField).props.autoFocus).toBe(true);
  });

  it("places read status after URL and tags", async () => {
    const renderer = await renderCommand();
    const children = renderer.root.findByType(Form).props.children as Array<{ type: unknown }>;

    expect(children.map((child) => child.type)).toEqual([Form.TextField, Form.TagPicker, Form.Checkbox]);
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

    const renderer = await renderCommand("not a url");
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

    const renderer = await renderCommand("not a url");
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

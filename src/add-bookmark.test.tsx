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
});

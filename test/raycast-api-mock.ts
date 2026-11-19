import { createElement, type ReactNode } from "react";
import { vi } from "vitest";

type Props = Record<string, unknown>;
interface Component {
  (props: Props): ReactNode;
  displayName?: string;
}

function createLeaf(displayName: string): Component {
  const Component: Component = () => null;
  Component.displayName = displayName;
  return Component;
}

function createContainer(displayName: string, extraProps: string[] = []): Component {
  const Component: Component = (props) =>
    createElement(
      "div",
      { "data-mock": displayName },
      props.children as ReactNode,
      ...extraProps.map((name) => props[name] as ReactNode),
    );
  Component.displayName = displayName;
  return Component;
}

export const Form = Object.assign(createContainer("Form", ["actions"]), {
  TextField: createLeaf("Form.TextField"),
  Checkbox: createLeaf("Form.Checkbox"),
  TagPicker: Object.assign(createLeaf("Form.TagPicker"), {
    Item: createLeaf("Form.TagPicker.Item"),
  }),
});

export const ActionPanel = createContainer("ActionPanel");
export const Action = Object.assign(createLeaf("Action"), {
  SubmitForm: createLeaf("Action.SubmitForm"),
});

export const Keyboard = {
  Shortcut: {
    Common: {
      Refresh: { modifiers: ["cmd"], key: "r" },
    },
  },
};

export const Toast = {
  Style: {
    Animated: "animated",
    Success: "success",
    Failure: "failure",
  },
};

export const Clipboard = {
  readText: vi.fn(async () => ""),
};

export const showToast = vi.fn(async () => ({}));
export const closeMainWindow = vi.fn(async () => undefined);
export const openExtensionPreferences = vi.fn(async () => undefined);
export const getPreferenceValues = vi.fn(() => ({ serverUrl: "", apiToken: "", tags: "" }));

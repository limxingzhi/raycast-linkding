import { createElement, forwardRef, useImperativeHandle, type ReactNode } from "react";
import { vi } from "vitest";

type Props = Record<string, unknown>;
interface Component {
  (props: Props): ReactNode;
  displayName?: string;
}

export const focusLog: string[] = [];

export function resetFocusLog(): void {
  focusLog.length = 0;
}

function createLeaf(displayName: string) {
  const Component = forwardRef<{ focus: () => void; reset: () => void }, Props>((props, ref) => {
    useImperativeHandle(ref, () => ({
      focus: () => {
        focusLog.push(displayName);
      },
      reset: () => undefined,
    }));

    return createElement("div", { "data-mock": displayName }, props.children as ReactNode);
  });
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
  Description: createLeaf("Form.Description"),
  TagPicker: Object.assign(createLeaf("Form.TagPicker"), {
    Item: createLeaf("Form.TagPicker.Item"),
  }),
});

export const ActionPanel = createContainer("ActionPanel");
export const Action = Object.assign(createLeaf("Action"), {
  SubmitForm: createLeaf("Action.SubmitForm"),
});

export const LaunchType = {
  UserInitiated: "userInitiated",
  Background: "background",
};

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

const localStorageData = new Map<string, string>();

export const LocalStorage = {
  getItem: vi.fn(async (key: string) => localStorageData.get(key)),
  setItem: vi.fn(async (key: string, value: string) => {
    localStorageData.set(key, value);
  }),
  removeItem: vi.fn(async (key: string) => {
    localStorageData.delete(key);
  }),
  clear: vi.fn(async () => {
    localStorageData.clear();
  }),
};

export function resetLocalStorage(): void {
  localStorageData.clear();
}

export const hideToast = vi.fn(async () => undefined);

export const showToast = vi.fn(
  async (options: { style?: string; title?: string; message?: string; primaryAction?: unknown } = {}) => ({
    ...options,
    show: vi.fn(async () => undefined),
    hide: hideToast,
  }),
);
export const closeMainWindow = vi.fn(async () => undefined);
export const openExtensionPreferences = vi.fn(async () => undefined);
export const getPreferenceValues = vi.fn(() => ({ serverUrl: "", apiToken: "", tags: "" }));

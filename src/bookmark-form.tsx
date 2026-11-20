import {
  Action,
  ActionPanel,
  Clipboard,
  Form,
  Keyboard,
  Toast,
  closeMainWindow,
  openExtensionPreferences,
  showToast,
} from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { createBookmark, getErrorMessage, isUnauthorized } from "./lib/linkding";
import { loadLastSettings, saveLastSettings } from "./lib/last-settings";
import { buildBookmarkPayload, validateBookmarkUrl } from "./lib/payload";
import { getSettings } from "./lib/preferences";
import { retainConfiguredTags } from "./lib/tags";
import { parseClipboardUrl, withDefaultScheme } from "./lib/url";

export interface BookmarkFormProps {
  reuseLastSettings?: boolean;
}

export function BookmarkForm({ reuseLastSettings = false }: BookmarkFormProps) {
  const [settings] = useState(() => getSettings());
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string>();
  const [read, setRead] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUrl, setHasUrl] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      const [clipboardText, lastSettings] = await Promise.all([
        Clipboard.readText().then(
          (text) => text,
          () => undefined,
        ),
        reuseLastSettings ? loadLastSettings() : Promise.resolve(undefined),
      ]);

      if (cancelled) {
        return;
      }

      const clipboardUrl = parseClipboardUrl(clipboardText ?? "");
      if (clipboardUrl) {
        setUrl(clipboardUrl);
        setHasUrl(true);
      }

      if (lastSettings) {
        setTags(retainConfiguredTags(lastSettings.tags, settings.tags));
        setRead(lastSettings.read);
      }

      setIsLoading(false);
    }

    void prepare();

    return () => {
      cancelled = true;
    };
  }, [reuseLastSettings, settings.tags]);

  if (isLoading) {
    return <Form isLoading />;
  }

  function handleUrlChange(value: string) {
    if (isSubmittingRef.current) {
      return;
    }

    setUrl(value);
    if (urlError) {
      setUrlError(validateBookmarkUrl(withDefaultScheme(value)));
    }
  }

  function handleTagsChange(value: string[]) {
    if (isSubmittingRef.current) {
      return;
    }

    setTags(value);
  }

  function handleReadChange(value: boolean) {
    if (isSubmittingRef.current) {
      return;
    }

    setRead(value);
  }

  async function handleSubmit() {
    if (isSubmittingRef.current) {
      return;
    }

    const normalizedUrl = withDefaultScheme(url);
    const validationMessage = validateBookmarkUrl(normalizedUrl);
    if (validationMessage) {
      setUrlError(validationMessage);
      return;
    }

    setUrl(normalizedUrl);
    setUrlError(undefined);
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      await createBookmark(buildBookmarkPayload({ url: normalizedUrl, read, tags }), settings);
      await saveLastSettings({ read, tags });
      await showToast({ style: Toast.Style.Success, title: "Bookmark saved" });
      await closeMainWindow();
    } catch (error) {
      if (isUnauthorized(error)) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Invalid API token",
          message: "Update the token in the extension preferences.",
          primaryAction: {
            title: "Open Extension Preferences",
            onAction: openExtensionPreferences,
          },
        });
      } else {
        await showToast({
          style: Toast.Style.Failure,
          title: "Could not save bookmark",
          message: getErrorMessage(error),
        });
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <Form
      isLoading={isSubmitting}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Bookmark" onSubmit={handleSubmit} />
          <Action
            title={read ? "Mark as Unread" : "Mark as Read"}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={() => handleReadChange(!read)}
          />
          <Action title="Open Extension Preferences" onAction={openExtensionPreferences} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="url"
        title="URL"
        placeholder="https://example.com"
        value={url}
        error={urlError}
        autoFocus={!hasUrl}
        onChange={handleUrlChange}
      />
      <Form.TagPicker
        id="tags"
        title="Tags"
        placeholder="Filter configured tags"
        value={tags}
        autoFocus={hasUrl}
        onChange={handleTagsChange}
      >
        {settings.tags.map((tag) => (
          <Form.TagPicker.Item key={tag} value={tag} title={tag} />
        ))}
      </Form.TagPicker>
      <Form.Checkbox
        id="read"
        title="Read status"
        label="Mark as read"
        value={read}
        info="Leave unchecked to save the bookmark as unread."
        onChange={handleReadChange}
      />
    </Form>
  );
}

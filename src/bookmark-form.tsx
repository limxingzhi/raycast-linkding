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

export interface BookmarkDraftValues {
  url?: string;
  tags?: string[];
  read?: boolean;
}

export interface BookmarkFormProps {
  reuseLastSettings?: boolean;
  draftValues?: BookmarkDraftValues;
}

export function BookmarkForm({ reuseLastSettings = false, draftValues }: BookmarkFormProps) {
  const [settings] = useState(() => getSettings());
  const hasDraft = draftValues !== undefined && Object.keys(draftValues).length > 0;
  const [url, setUrl] = useState(() => draftValues?.url ?? "");
  const [urlError, setUrlError] = useState<string>();
  const [tokenError, setTokenError] = useState(false);
  const [read, setRead] = useState(() => draftValues?.read ?? false);
  const [tags, setTags] = useState<string[]>(() =>
    draftValues?.tags ? retainConfiguredTags(draftValues.tags, settings.tags) : [],
  );
  const [hasUrl, setHasUrl] = useState(() => Boolean(draftValues?.url));
  const isSubmittingRef = useRef(false);
  const hasEditedRef = useRef(hasDraft);
  const tagsRef = useRef<Form.TagPicker>(null);

  useEffect(() => {
    if (hasDraft) {
      return;
    }

    let cancelled = false;

    void Clipboard.readText().then(
      (text) => {
        if (cancelled || hasEditedRef.current) {
          return;
        }

        const clipboardUrl = parseClipboardUrl(text ?? "");
        if (clipboardUrl) {
          setUrl(clipboardUrl);
          setHasUrl(true);
        }
      },
      () => undefined,
    );

    if (reuseLastSettings) {
      void loadLastSettings().then((lastSettings) => {
        if (cancelled || hasEditedRef.current) {
          return;
        }

        setTags(retainConfiguredTags(lastSettings.tags, settings.tags));
        setRead(lastSettings.read);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [hasDraft, reuseLastSettings, settings.tags]);

  useEffect(() => {
    if (!hasUrl || hasEditedRef.current) {
      return;
    }

    tagsRef.current?.focus();
  }, [hasUrl]);

  function handleUrlChange(value: string) {
    hasEditedRef.current = true;
    setUrl(value);
    setTokenError(false);
    if (urlError) {
      setUrlError(validateBookmarkUrl(withDefaultScheme(value)));
    }
  }

  function handleTagsChange(value: string[]) {
    hasEditedRef.current = true;
    setTags(value);
    setTokenError(false);
  }

  function handleReadChange(value: boolean) {
    hasEditedRef.current = true;
    setRead(value);
    setTokenError(false);
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
    setTokenError(false);
    isSubmittingRef.current = true;
    const toast = await showToast({ style: Toast.Style.Animated, title: "Saving bookmark" });

    try {
      await createBookmark(buildBookmarkPayload({ url: normalizedUrl, read, tags }), settings);
      await saveLastSettings({ read, tags });
      await toast.hide();
      await closeMainWindow();
    } catch (error) {
      if (isUnauthorized(error)) {
        setTokenError(true);
        toast.style = Toast.Style.Failure;
        toast.title = "Invalid API token";
        toast.message = "Update the token in the extension preferences.";
        toast.primaryAction = {
          title: "Open Extension Preferences",
          onAction: openExtensionPreferences,
        };
      } else {
        toast.style = Toast.Style.Failure;
        toast.title = "Could not save bookmark";
        toast.message = getErrorMessage(error);
      }
    } finally {
      isSubmittingRef.current = false;
    }
  }

  return (
    <Form
      enableDrafts
      actions={
        <ActionPanel>
          {tokenError ? <Action title="Open Extension Preferences" onAction={openExtensionPreferences} /> : null}
          <Action.SubmitForm title="Save Bookmark" onSubmit={handleSubmit} />
          <Action
            title={read ? "Mark as Unread" : "Mark as Read"}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={() => handleReadChange(!read)}
          />
          {tokenError ? null : <Action title="Open Extension Preferences" onAction={openExtensionPreferences} />}
        </ActionPanel>
      }
    >
      <Form.TextField
        id="url"
        title="URL"
        placeholder="https://example.com"
        autoFocus
        value={url}
        error={urlError}
        onChange={handleUrlChange}
      />
      <Form.TagPicker
        id="tags"
        title="Tags"
        placeholder="Filter configured tags"
        value={tags}
        ref={tagsRef}
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

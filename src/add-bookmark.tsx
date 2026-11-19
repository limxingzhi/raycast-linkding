import {
  Action,
  ActionPanel,
  Form,
  LaunchProps,
  Toast,
  closeMainWindow,
  openExtensionPreferences,
  showToast,
} from "@raycast/api";
import { useRef, useState } from "react";
import { createBookmark, getErrorMessage, isUnauthorized } from "./lib/linkding";
import { buildBookmarkPayload, validateBookmarkUrl } from "./lib/payload";
import { getSettings } from "./lib/preferences";
import { withDefaultScheme } from "./lib/url";

interface AddBookmarkArguments {
  link?: string;
}

export default function AddBookmarkCommand(props: LaunchProps<{ arguments: AddBookmarkArguments }>) {
  const [settings] = useState(() => getSettings());
  const initialUrl = props.arguments?.link?.trim() ?? "";
  const hasLink = initialUrl.length > 0;
  const [url, setUrl] = useState(initialUrl);
  const [urlError, setUrlError] = useState<string>();
  const [read, setRead] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

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
        autoFocus={!hasLink}
        onChange={handleUrlChange}
      />
      <Form.TagPicker
        id="tags"
        title="Tags"
        placeholder="Filter configured tags"
        value={tags}
        autoFocus={hasLink}
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

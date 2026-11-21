import { LaunchProps } from "@raycast/api";
import { BookmarkForm, type BookmarkDraftValues } from "./bookmark-form";

export default function AddBookmarkCommand({ draftValues }: LaunchProps<{ draftValues: BookmarkDraftValues }>) {
  return <BookmarkForm draftValues={draftValues} />;
}

import { LaunchProps } from "@raycast/api";
import { BookmarkForm, type BookmarkDraftValues } from "./bookmark-form";

export default function RepeatBookmarkCommand({ draftValues }: LaunchProps<{ draftValues: BookmarkDraftValues }>) {
  return <BookmarkForm reuseLastSettings draftValues={draftValues} />;
}

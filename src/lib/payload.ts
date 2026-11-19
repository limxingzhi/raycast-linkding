import { z } from "zod";
import { isValidBookmarkUrl } from "./url";

export const bookmarkUrlSchema = z
  .string()
  .trim()
  .min(1, "Enter a URL")
  .refine(isValidBookmarkUrl, "Enter a valid http or https URL");

export const bookmarkPayloadSchema = z.object({
  url: bookmarkUrlSchema,
  unread: z.boolean(),
  tag_names: z.array(z.string()),
});

export type BookmarkPayload = z.infer<typeof bookmarkPayloadSchema>;

export interface BookmarkFormState {
  url: string;
  read: boolean;
  tags: string[];
}

export function buildBookmarkPayload(state: BookmarkFormState): BookmarkPayload {
  const result = bookmarkPayloadSchema.safeParse({
    url: state.url,
    unread: !state.read,
    tag_names: state.tags,
  });

  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Enter a valid bookmark.");
  }

  return result.data;
}

export function validateBookmarkUrl(value: string): string | undefined {
  const result = bookmarkUrlSchema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

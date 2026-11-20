import { LocalStorage } from "@raycast/api";
import { z } from "zod";

const STORAGE_KEY = "last-bookmark-settings";

export const lastBookmarkSettingsSchema = z.object({
  read: z.boolean(),
  tags: z.array(z.string()),
});

export type LastBookmarkSettings = z.infer<typeof lastBookmarkSettingsSchema>;

export const EMPTY_LAST_SETTINGS: LastBookmarkSettings = { read: false, tags: [] };

export async function loadLastSettings(): Promise<LastBookmarkSettings> {
  try {
    const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
    if (!raw) {
      return EMPTY_LAST_SETTINGS;
    }

    const result = lastBookmarkSettingsSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : EMPTY_LAST_SETTINGS;
  } catch {
    return EMPTY_LAST_SETTINGS;
  }
}

export async function saveLastSettings(settings: LastBookmarkSettings): Promise<void> {
  const result = lastBookmarkSettingsSchema.safeParse(settings);
  if (!result.success) {
    return;
  }

  await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(result.data)).catch(() => undefined);
}

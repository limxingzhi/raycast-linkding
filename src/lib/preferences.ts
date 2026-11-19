import { getPreferenceValues } from "@raycast/api";
import { parseTagList } from "./tags";
import { normalizeServerUrl } from "./url";

export interface LinkdingPreferences {
  serverUrl: string;
  apiToken: string;
  tags?: string;
}

export interface LinkdingSettings {
  baseUrl: string;
  apiToken: string;
  tags: string[];
}

export function resolveSettings(preferences: LinkdingPreferences): LinkdingSettings {
  return {
    baseUrl: normalizeServerUrl(preferences.serverUrl ?? ""),
    apiToken: preferences.apiToken ?? "",
    tags: parseTagList(preferences.tags),
  };
}

export function getSettings(): LinkdingSettings {
  return resolveSettings(getPreferenceValues<LinkdingPreferences>());
}

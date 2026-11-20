export function parseTagList(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const entry of value.split(",")) {
    const tag = entry.trim();
    if (!tag) {
      continue;
    }

    const key = tag.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    tags.push(tag);
  }

  return tags;
}

export function retainConfiguredTags(tags: string[], configured: string[]): string[] {
  const allowed = new Map(configured.map((tag) => [tag.toLowerCase(), tag]));
  const retained: string[] = [];
  const seen = new Set<string>();

  for (const tag of tags) {
    const key = tag.toLowerCase();
    const configuredTag = allowed.get(key);
    if (!configuredTag || seen.has(key)) {
      continue;
    }

    seen.add(key);
    retained.push(configuredTag);
  }

  return retained;
}

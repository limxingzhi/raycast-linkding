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

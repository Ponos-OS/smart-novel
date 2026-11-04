export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

export function normalizeTagNames(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  const normalized = value.map((name) =>
    typeof name === 'string' ? normalizeTagName(name) : name,
  );

  return [...new Set(normalized)];
}

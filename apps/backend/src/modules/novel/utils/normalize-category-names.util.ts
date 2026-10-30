export function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase();
}

export function normalizeCategoryNames(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  const normalized = value.map((name) =>
    typeof name === 'string' ? normalizeCategoryName(name) : name,
  );

  return [...new Set(normalized)];
}

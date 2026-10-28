export function normalizeCategoryNames(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  const normalized = value.map((name) =>
    typeof name === 'string' ? name.trim().toLowerCase() : name,
  );

  return [...new Set(normalized)];
}

export function safeParseTemporalInstant(
  value: string | undefined | null,
): Temporal.Instant | undefined {
  if (!value) return undefined;
  try {
    return Temporal.Instant.from(value);
  } catch {
    return undefined;
  }
}

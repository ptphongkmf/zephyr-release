export class InvariantError extends Error {
  override name = "InvariantError";
}

export function invariant(
  condition: unknown,
  message: string | (() => string) = "Invariant failed",
): asserts condition {
  if (!condition) {
    throw new InvariantError(
      typeof message === "function" ? message() : message,
    );
  }
}

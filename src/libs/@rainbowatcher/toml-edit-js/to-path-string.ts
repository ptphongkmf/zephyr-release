/**
 * Convert a path array (e.g. from nimma) to a TOML path string for @rainbowatcher/toml-edit-js.
 * Format: "key.subkey[0].field" - keys as-is, indices as [n]; keys with dots/spaces quoted.
 */
export function toTomlPathString(pathArray: (string | number)[]): string {
  return pathArray.reduce<string>((acc, seg, i) => {
    if (typeof seg === "number") {
      // Numbers are always in brackets, no dot needed before them
      return acc + `[${seg}]`;
    }

    const needsQuotes = /[^a-zA-Z0-9_-]/.test(seg) ? `"${seg}"` : seg;

    // Add dot separator only if not the first segment
    return i === 0 ? needsQuotes : acc + `.${needsQuotes}`;
  }, "");
}

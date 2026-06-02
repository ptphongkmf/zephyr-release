import picomatch from "picomatch";

/**
 * Converts a LiquidJS template like `{{ name }}-v{{ nextVersion }}`
 * into a glob pattern like `*-v*`.
 *
 * Replaces all `{{ ... }}` tokens (including filters) with `*`.
 */
export function templateToMatchPattern(template: string): string {
  return template.replace(/\{\{.*?\}\}/g, "*");
}

/**
 * Build an array of RegExp match patterns from:
 * 1. Auto-derived pattern from `nameTemplate` (always included)
 * 2. User-provided `matchPatterns` globs (if any)
 */
export function buildMatchPatterns(
  nameTemplate: string,
  userMatchPatterns?: string[],
): RegExp[] {
  const derived = templateToMatchPattern(nameTemplate);
  const globs = new Set([derived, ...(userMatchPatterns ?? [])]);
  return Array.from(globs).map((glob) => picomatch.makeRe(glob));
}

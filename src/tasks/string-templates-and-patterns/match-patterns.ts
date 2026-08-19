import picomatch from "picomatch";
import { escape } from "@std/regexp";

/**
 * Converts a LiquidJS template like `{{ name }}-v{{ nextVersion }}`
 * into a precise RegExp like `/^name\-v.*$/`.
 *
 * It escapes all literal parts of the template so that characters
 * like `[` or `.` aren't accidentally treated as regex/glob metacharacters,
 * and replaces all `{{ ... }}` tokens with `.*`.
 */
export function templateToRegexPattern(template: string): RegExp {
  const parts = template.split(/\{\{[\s\S]*?\}\}/g);
  const escapedParts = parts.map((part) => escape(part));
  return new RegExp("^" + escapedParts.join(".*") + "$");
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
  const derivedRegex = templateToRegexPattern(nameTemplate);
  
  const regexes = (userMatchPatterns ?? []).map((glob) =>
    picomatch.makeRe(glob)
  );
  
  return [derivedRegex, ...regexes];
}

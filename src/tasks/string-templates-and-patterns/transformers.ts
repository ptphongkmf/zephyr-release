import { escape } from "@std/regexp";
import { liquidEngine } from "./resolve-template.ts";
import * as v from "@valibot/valibot";
import type { PlatformProvider } from "../../types/providers/platform-provider.ts";

export function registerTransformersToTemplateEngine(
  provider: PlatformProvider,
) {
  liquidEngine.registerFilter(
    "wrap_compare_tag",
    (txt: unknown, tag1: unknown, tag2: unknown) => {
      if (typeof txt !== "string") {
        throw new Error(
          `Transformer "wrap_compare_tag" input requires a string, received ${typeof txt}`,
        );
      }
      if (typeof tag1 !== "string") {
        throw new Error(
          `Transformer "wrap_compare_tag" arg 1 \`tag1\` requires a string, received ${typeof tag1}`,
        );
      }
      if (typeof tag2 !== "string") {
        throw new Error(
          `Transformer "wrap_compare_tag" arg 2 \`tag2\` requires a string, received ${typeof tag2}`,
        );
      }

      return `[${txt}](${provider.getCompareTagUrl(tag1, tag2)})`;
    },
  );

  liquidEngine.registerFilter(
    "wrap_compare_latest_tag",
    async (txt: unknown, currentTag: unknown, skip: unknown = 0) => {
      if (typeof txt !== "string") {
        throw new Error(
          `Filter "wrap_compare_latest_tag" input requires a string, received ${typeof txt}`,
        );
      }
      if (typeof currentTag !== "string") {
        throw new Error(
          `Filter "wrap_compare_latest_tag" arg 1 \`currentTag\` requires a string, received ${typeof currentTag}`,
        );
      }
      if (skip !== undefined) {
        if (typeof skip !== "number") {
          throw new Error(
            `Filter "wrap_compare_latest_tag" arg 2 \`skip\` requires a number (positive integer), received ${typeof skip}`,
          );
        }
        if (!Number.isInteger(skip) || skip < 0) {
          throw new Error(
            `Filter "wrap_compare_latest_tag" arg 2 \`skip\` must be a positive integer, received ${skip}`,
          );
        }
      }

      const url = await provider.getCompareTagUrlFromCurrentToLatest(
        currentTag,
        skip,
      );
      return `[${txt}](${url})`;
    },
  );

  liquidEngine.registerFilter(
    "format_commit_references",
    (txt: unknown, commit: unknown) => {
      if (typeof txt !== "string") {
        throw new Error(
          `Transformer "format_commit_references" input requires a string, received ${typeof txt}`,
        );
      }

      const parsedCommitResult = v.safeParse(
        parseReferencesCommitSchema,
        commit,
      );
      if (!parsedCommitResult.success) {
        throw new Error(
          `Transformer "format_commit_references" arg 1 \`commit\` requires an object with shape ` +
            `{ references: { prefix: string, issue: string }[] }, ` +
            `received ${JSON.stringify(commit, null, 2)}`,
        );
      }

      const { references } = parsedCommitResult.output;
      if (references.length === 0) return txt;

      const referenceMap = new Map<string, string>();
      const uniqueRefs: string[] = [];

      for (const ref of references) {
        const referenceString = ref.prefix + ref.issue;

        // Only process if it actually exists in the text and hasn't been mapped yet
        if (
          txt.includes(referenceString) && !referenceMap.has(referenceString)
        ) {
          const url = provider.getReferenceUrl(referenceString);

          referenceMap.set(referenceString, `[${referenceString}](${url})`);
          uniqueRefs.push(referenceString);
        }
      }

      if (uniqueRefs.length === 0) return txt;

      // Sort by length descending to fix the "ISSUE-12 vs ISSUE-1" overlap bug (edge case)
      uniqueRefs.sort((a, b) => b.length - a.length);

      // Create a single global regex matching all references.
      // Example output: /ISSUE\-12|ISSUE\-1/g
      const pattern = new RegExp(uniqueRefs.map(escape).join("|"), "g");

      // Replace all occurrences in one pass.
      // The replacer function guarantees no double-replacements.
      return txt.replace(pattern, (match) => {
        const replacement = referenceMap.get(match);

        if (replacement === undefined) {
          throw new Error(
            `The regex matched the reference "${match}", but no corresponding markdown link was found in the internal ` +
              "reference map.",
          );
        }

        return replacement;
      });
    },
  );

  liquidEngine.registerFilter(
    "format_releases",
    (releases: unknown, separator?: unknown) => {
      const parsedReleases = v.safeParse(parseFormatReleasesSchema, releases);
      if (!parsedReleases.success) {
        throw new Error(
          `Filter "format_releases" input is invalid: requires an array of objects with a string "tagName" property.`,
        );
      }

      const sep = typeof separator === "string" ? separator : ", ";

      return parsedReleases.output.map((r) => r.tagName).join(sep);
    },
  );
}

const parseFormatReleasesSchema = v.array(v.object({ tagName: v.string() }));

const parseReferencesCommitSchema = v.object({
  references: v.array(v.object({ prefix: v.string(), issue: v.string() })),
});

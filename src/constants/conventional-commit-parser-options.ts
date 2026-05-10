import type { ParserOptions } from "conventional-commits-parser";
import { ZEPHYR_RELEASE_COMMIT_SIGN } from "./commit.ts";

export const breakingChangeKeywords = {
  space: "BREAKING CHANGE",
  hyphen: "BREAKING-CHANGE",
} as const;

/**
 * Builds on the library's default settings with support for modern features.
 *
 * See: https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-commits-parser/src/options.ts
 *
 * * Note: The "conventional-commits-parser" uses a shallow merge. This means
 * we only need to define the properties we want to change or add.
 */
export const baseConventionalCommitParserOptions = {
  /**
   * Default Options from "conventional-commits-parser". For reference only.
   */
  // noteKeywords: ["BREAKING CHANGE", "BREAKING-CHANGE"],
  // issuePrefixes: ["#"],
  // referenceActions: [
  //   "close",
  //   "closes",
  //   "closed",
  //   "fix",
  //   "fixes",
  //   "fixed",
  //   "resolve",
  //   "resolves",
  //   "resolved",
  // ],
  // headerPattern: /^(\w*)(?:\(([\w$@.\-*/ ]*)\))?: (.*)$/,
  // headerCorrespondence: [
  //   "type",
  //   "scope",
  //   "subject",
  // ],
  // revertPattern: /^Revert\s"([\s\S]*)"\s*This reverts commit (\w*)\./,
  // revertCorrespondence: ["header", "hash"],
  // fieldPattern: /^-(.*?)-$/,

  // =======================================================================

  // --- Modern Header Support ---
  // This pattern supports the "!" for breaking changes: feat(api)!: subject
  headerPattern: /^(\w*)(?:\(([\w$@.\-*/ ]*)\))?(!?): (.*)$/,
  headerCorrespondence: ["type", "scope", "breaking", "subject"],

  // --- Flexible Revert Support ---
  // Matches the standard Git format used by most CLI and web tools, with or without a colon

  // --- Flexible Revert Support ---
  // Matches standard Git revert formats as well as custom trailers (Refs, Reverts, etc.).
  // Note: We intentionally use a non-capturing group for the original commit's header
  // and only extract the `hash`. This forces `conventional-commits-filter` to match
  // revert pairs strictly by their commit hash, bypassing its default behavior which
  // requires the subject lines to match perfectly.
  revertPattern:
    /^(?:Revert|revert)(?:\([^)]+\))?:?\s+[\s\S]*?(?:This reverts commit|This revert commit|Reverts|Revert|Refs:|Ref:)\s+([\w\d]+)/im,
  revertCorrespondence: ["hash"],

  noteKeywords: [
    breakingChangeKeywords.space,
    breakingChangeKeywords.hyphen,
    "release as",
    "release-as",

    ZEPHYR_RELEASE_COMMIT_SIGN,
  ],

  issuePrefixes: ["#"],
  referenceActions: [
    "close",
    "closes",
    "closed",
    "fix",
    "fixes",
    "fixed",
    "resolve",
    "resolves",
    "resolved",
  ],
} satisfies ParserOptions;

import { type CommitBase, CommitParser } from "conventional-commits-parser";
import { filterRevertedCommitsSync } from "conventional-commits-filter";
import type { ProviderCommit } from "../../src/types/providers/commit.ts";
import { DEFAULT_COMMIT_TYPES } from "../../src/constants/defaults/commit.ts";
import { createGitHubProvider } from "../../src/providers/github/github-provider.ts";

type ResolvedCommit = CommitBase & {
  hash: string;
  type: string;
  scope?: string;
  subject: string;
  breaking?: string; // This is the "!" char
  isBreaking: boolean;
  revert: any;
};

// Mock raw commits for testing
const mockRawCommits: Partial<ProviderCommit>[] = [
  // 1. STANDARD PAIR: No quotes, standard header match
  {
    hash: "aaa111",
    message: "feat(ui): add old paper background",
  },
  {
    hash: "bbb222",
    message:
      "revert: feat(ui): add old paper background\n\nThis reverts commit aaa111.",
  },

  // 2. QUOTED PAIR: Testing if your parser/filter handles the "Quoted" style
  {
    hash: "ccc333",
    message: "fix(api): resolve race condition in sync",
  },
  {
    hash: "ddd444",
    message:
      'revert: "fix(api): resolve race condition in sync"\n\nThis reverts commit ccc333.',
  },

  // 3. MISMATCHED SUBJECT: This SHOULD FAIL to filter (Custom message)
  // actually, it should be success now if we make it flexible enough
  {
    hash: "eee555",
    message: "refactor(db): simplify indexedDB schema",
  },
  {
    hash: "fff666",
    message:
      "revert: oops the schema change broke everything\n\nThis reverts commit eee555.",
  },

  // 4. FOOTER REFERENCE (Refs: style)
  {
    hash: "ggg777",
    message: "feat(auth): add guest login",
  },
  {
    hash: "hhh888",
    message:
      "revert(test-with-scope): feat(auth): add guest login\n\nRevert ggg777",
  },

  // 5. THE "ORPHAN": A feature that stays (no revert)
  {
    hash: "iii999",
    message: "feat(core): implement byethrow logic",
  },
];

const provider = createGitHubProvider();
const commitTypes = DEFAULT_COMMIT_TYPES;

const rawCommits = mockRawCommits;

// Options is shallow merged with the library defaults
const commitParser = new CommitParser(
  provider.getConventionalCommitParserOptions(),
);

const allowedTypes = new Set(commitTypes.map((c) => c.type));
const parsedFilteredCommits: ResolvedCommit[] = [];

for (const raw of rawCommits) {
  const commit = commitParser.parse(raw.message ?? "");
  const isRevert = !!commit.revert;

  const type = commit.type?.toLowerCase();
  const subject = commit.subject;

  if (!isRevert && (!type || !allowedTypes.has(type))) continue;

  const hasBreakingNote = commit.notes.some(
    (n) => n.title === "BREAKING CHANGE" || n.title === "BREAKING-CHANGE",
  );
  const isBreaking = !!commit.breaking || !!hasBreakingNote;

  if (isBreaking && !hasBreakingNote) {
    commit.notes.push({
      title: "BREAKING CHANGE",
      text: subject ?? "",
    });
  }

  parsedFilteredCommits.push({
    ...commit,
    hash: raw.hash ?? "",
    type: type ?? "",
    subject: subject ?? "",
    isBreaking,
    revert: commit.revert,
  });
}

const resolvedCommits = Array.from(
  filterRevertedCommitsSync(parsedFilteredCommits.reverse()),
);

console.log("Resolved (parsed and filtered) commits:");
// console.log(JSON.stringify(parsedFilteredCommits, null, 2));
console.log(JSON.stringify(resolvedCommits, null, 2));

console.log(`\nTotal resolved commits: ${resolvedCommits.length}`);

# Phase 1: Tag Match Patterns & Provider Refactor

> **Scope:** Single-repo compatible. No monorepo dependency.  
> **Breaking changes:** Yes — removes `getLatestRelease` fallback and `parseLooseSemVer` tag coercion from commit resolution.  
> **Prerequisite for:** Phase 2, Phase 3 (monorepo)

---

## Summary

Refactor how the tool finds the "last release" commit hash. Currently, `githubListCommitsFromGivenToLastRelease` is a monolithic function that:
1. Calls `repos.getLatestRelease` to find the stop hash.
2. Falls back to coercing tag names via `parseLooseSemVer`.
3. Walks commits until the stop hash.

This is replaced with two clean provider methods and a new `tag.matchPatterns` config property.

---

## Files to Change

### Schema

#### [MODIFY] [tag-config.ts](file:///g:/Projects/Coding/zephyr-release/src/schemas/configs/modules/tag-config.ts)
Add `matchPatterns` field to `TagConfigSchema`:
```typescript
matchPatterns: v.pipe(
  v.optional(
    v.union([
      trimNonEmptyStringSchema,
      v.pipe(v.array(trimNonEmptyStringSchema), v.nonEmpty()),
    ]),
  ),
  v.transform((input) => {
    if (input !== undefined) {
      return Array.isArray(input) ? input : [input];
    }
    return input;
  }),
  v.metadata({
    description:
      "Glob pattern(s) to match existing tags when searching for the last release. " +
      "If not provided, a pattern is auto-derived from `nameTemplate`.\n" +
      "Use this when migrating from a different tag naming convention.",
    examples: [["v*"], ["release-*", "v*"]],
  }),
),
```

---

### Utilities

#### [NEW] [template-to-pattern.ts](file:///g:/Projects/Coding/zephyr-release/src/utils/template-to-pattern.ts)
New utility to convert a LiquidJS template into a glob/regex match pattern:

```typescript
/**
 * Converts a LiquidJS template like `{{ name }}-v{{ nextVersion }}`
 * into a glob pattern like `*-v*`.
 *
 * Replaces all {{ ... }} tokens (including filters) with `*`.
 * Escapes any regex-special characters in the literal parts.
 */
export function templateToMatchPattern(template: string): string {
  return template.replace(/\{\{.*?\}\}/g, "*");
}

/**
 * Converts a glob pattern like `v*` or `core-v*` into a RegExp.
 * Only supports `*` (match anything) and `?` (match single char).
 */
export function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")  // escape regex chars
    .replace(/\*/g, ".*")                    // * → .*
    .replace(/\?/g, ".");                    // ? → .
  return new RegExp(`^${escaped}$`);
}
```

---

### Provider Interface

#### [MODIFY] [platform-provider.ts](file:///g:/Projects/Coding/zephyr-release/src/types/providers/platform-provider.ts)
Replace `listCommitsFromGivenToLastRelease` and `getLatestReleaseTag` with:

```typescript
// REMOVE:
// listCommitsFromGivenToLastRelease(...)
// getLatestReleaseTag(...)

// ADD:
/**
 * Find the commit hash of the last release by matching tags against patterns.
 */
findLastReleaseHash(
  matchPatterns: RegExp[],
  maxTagsToScan?: number,
): Promise<{ hash: string; tagName: string } | undefined>;

/**
 * List commits from a starting point, optionally filtered by file path.
 * Stops walking when stopHash is encountered (exclusive).
 */
listCommitsInRange(
  fromHash: string,
  stopHash?: string,
  path?: string,
  maxCommits?: number,
): Promise<ProviderCommit[]>;
```

---

### GitHub Provider

#### [MODIFY] [commit.ts](file:///g:/Projects/Coding/zephyr-release/src/providers/github/commit.ts)
- **Delete** `githubListCommitsFromGivenToLastRelease` entirely.
- **Delete** the `parseLooseSemVer` import and all coerced-tag-map logic.
- **Add** `githubListCommitsInRange`:

```typescript
async function githubListCommitsInRange(
  octokit: OctokitClient,
  fromHash: string,
  stopHash?: string,
  path?: string,
  maxCommits: number = 100,
): Promise<ProviderCommit[]> {
  const commitsIterator = octokit.paginate.iterator(
    octokit.rest.repos.listCommits,
    {
      owner: githubGetNamespace(),
      repo: githubGetRepositoryName(),
      sha: fromHash,
      path: path,  // GitHub API filters server-side
      per_page: 100,
    },
  );

  const collected: ProviderCommit[] = [];
  for await (const response of commitsIterator) {
    for (const commit of response.data) {
      if (stopHash && commit.sha === stopHash) return collected;

      collected.push(/* map commit to ProviderCommit */);

      if (collected.length >= maxCommits) return collected;
    }
  }

  if (collected.length === 0) {
    throw new NoCommitFoundError(`No commits found for hash ${fromHash.substring(0, 7)}`);
  }
  return collected;
}
```

#### [MODIFY] [tag.ts](file:///g:/Projects/Coding/zephyr-release/src/providers/github/tag.ts)
- **Delete** `githubGetLatestReleaseTag` and its `makeGithubGetLatestReleaseTag`.
- **Add** `githubFindLastReleaseHash`:

```typescript
async function githubFindLastReleaseHash(
  octokit: OctokitClient,
  matchPatterns: RegExp[],
  maxTagsToScan: number = 100,
): Promise<{ hash: string; tagName: string } | undefined> {
  let scanned = 0;
  const tagsIterator = octokit.paginate.iterator(
    octokit.rest.repos.listTags,
    {
      owner: githubGetNamespace(),
      repo: githubGetRepositoryName(),
      per_page: 100,
    },
  );

  for await (const response of tagsIterator) {
    for (const tag of response.data) {
      if (matchPatterns.some(p => p.test(tag.name))) {
        return { hash: tag.commit.sha, tagName: tag.name };
      }
      scanned++;
      if (scanned >= maxTagsToScan) return undefined;
    }
  }
  return undefined;
}
```

#### [MODIFY] [github-provider.ts](file:///g:/Projects/Coding/zephyr-release/src/providers/github/github-provider.ts)
Update the provider object to wire up the new methods and remove old ones.

---

### Task Layer

#### [MODIFY] [commit.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/commit.ts)
Update `resolveCommitsFromTriggerToLastRelease` to use the new provider methods:

```typescript
export async function resolveCommitsFromTriggerToLastRelease(
  provider: PlatformProvider,
  inputs: ResolveCommitsInputsParams,
  config: ResolveCommitsConfigParams,  // now includes tag.matchPatterns + tag.nameTemplate
): Promise<ResolvedCommitsResult> {
  const { triggerCommitHash } = inputs;
  const { commitTypes, maxCommitsToResolve, resolveUntilCommitHash } = config;

  let stopHash = resolveUntilCommitHash;
  if (!stopHash) {
    // Build match patterns: auto-derived from nameTemplate + user-provided matchPatterns
    const patterns = buildMatchPatterns(config.tag.nameTemplate, config.tag.matchPatterns);
    const lastRelease = await provider.findLastReleaseHash(patterns);
    stopHash = lastRelease?.hash;
  }

  const rawCommits = await provider.listCommitsInRange(
    triggerCommitHash,
    stopHash,
    undefined,  // no path filter for single-repo
    maxCommitsToResolve,
  );

  // ... rest of parsing/filtering logic unchanged
}
```

Update `ResolveCommitsConfigParams` Pick type to include `tag` fields.

---

### Cleanup

#### [MODIFY] [utils/parsers/semver.ts](file:///g:/Projects/Coding/zephyr-release/src/utils/parsers/semver.ts)
If `parseLooseSemVer` is only used in the deleted commit resolution code, remove it. If used elsewhere, keep it.

#### [MODIFY] [changelog.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/changelog.ts)
Update `getCompareTagUrlFromCurrentToLatest` call sites if the provider method signature changed.

---

## Verification

### Type Checking
```bash
deno task check
```

### Local Logic Testing (experiments/)

Create `experiments/tag-match-patterns.ts` to test the pure utility functions:

```typescript
import { templateToMatchPattern, globToRegex } from "../src/utils/template-to-pattern.ts";

// Test templateToMatchPattern
const cases = [
  { input: "v{{ nextVersion }}", expected: "v*" },
  { input: "{{ name }}-v{{ nextVersion }}", expected: "*-v*" },
  { input: "release/{{ name }}/v{{ nextVersion }}", expected: "release/*/v*" },
  { input: "{{ name | upcase }}-v{{ nextVersion }}", expected: "*-v*" },
];

for (const { input, expected } of cases) {
  const result = templateToMatchPattern(input);
  console.log(`templateToMatchPattern("${input}") => "${result}" ${result === expected ? "✅" : `❌ expected "${expected}"`}`);
}

// Test globToRegex
const globCases = [
  { glob: "v*", tag: "v1.2.3", expected: true },
  { glob: "v*", tag: "release-1.2.3", expected: false },
  { glob: "*-v*", tag: "core-v1.2.3", expected: true },
  { glob: "*-v*", tag: "v1.2.3", expected: false },
  { glob: "release-*", tag: "release-2.0.0", expected: true },
];

for (const { glob, tag, expected } of globCases) {
  const regex = globToRegex(glob);
  const result = regex.test(tag);
  console.log(`globToRegex("${glob}").test("${tag}") => ${result} ${result === expected ? "✅" : `❌ expected ${expected}`}`);
}
```

Run with:
```bash
deno run experiments/tag-match-patterns.ts
```

### JSON Schema Regeneration
```bash
deno run -A scripts/gen-json-schema.ts
```
Verify `matchPatterns` (or `match-patterns` / `match_patterns`) appears in all 3 casing variants under `tag`.

### Post-Test: Real GitHub API (Manual)

See [1_post-test.md](file:///g:/Projects/Coding/zephyr-release/docs/monorepo/implementations/1_post-test.md) for testing on a real repository.

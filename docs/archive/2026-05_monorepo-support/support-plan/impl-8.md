# Monorepo Support — Evaluation of Answers & Final Pre-Plan Review (Draft 8)

> **Status:** Draft / Final Review Before Implementation Plan  
> **Date:** 2026-05-29  
> **Purpose:** Evaluate answers from `impl-7-answer.md`, concede on critical architecture changes, and resolve the remaining open decisions.

---

## Q1 Revisited — Should Single-Repo Also Drop `getLatestRelease`?

Your edge case is valid: a user switches from GitHub Releases to tag-only. The `getLatestRelease` call would return the stale old release and find the wrong "stop" hash.

**My updated recommendation: Drop `getLatestRelease` entirely. Use tag pattern matching for both single-repo and monorepo.**

Reasons:
1. **Eliminates the stale-release edge case** you identified.
2. **Unifies the resolution logic** — one code path for both modes.
3. **`getLatestRelease` was always fragile** — it depends on the user having GitHub Releases enabled. Many repos only use tags.
4. The `tag.matchPatterns` + auto-derived pattern from `nameTemplate` already covers every case that `getLatestRelease` handled.

The resolution flow becomes:
1. List tags from the repository (paginated, up to a configurable limit).
2. Filter tags matching `tag.matchPatterns` (user-provided) + auto-derived pattern from `tag.nameTemplate`.
3. For each matching tag, resolve the commit hash it points to.
4. Walk commits from trigger until we hit one of those hashes.

This also means removing the `parseLooseSemVer` coercion entirely, since tags are now matched by pattern, not by "does this vaguely look like a version."

---

## Q2 Revisited — Should `review` be included in workspace config?

**You are right. I was wrong to fully omit `review`.**

Your reasoning is correct: when `group-proposals: false`, each workspace has its own PR/branch. In that scenario, it is entirely logical for each workspace to customize:
- `review.workingBranchNameTemplate` — per-workspace branch name
- `review.titleTemplate` / `review.bodyTemplate` — per-workspace PR title/body
- `review.draft` — maybe one workspace's PR should be draft while another isn't

**Updated decision: Include `review` in workspace config, but omit select global-only properties.**

Properties to **omit from workspace `review`**:
- `review.labels` — labels are applied to the PR, and since `group-proposals: true` means one PR, labels should be global. Even with `group-proposals: false`, managing labels per-workspace is excessive for v1.
- `review.assignees` / `review.reviewers` — same reasoning as labels.

Properties to **include in workspace `review`**:
- `review.workingBranchNameTemplate` — per-workspace branch naming (when `group-proposals: false`)
- `review.draft` — per-workspace draft toggle
- `review.titleTemplate` / `review.titleTemplatePath`
- `review.headerTemplate` / `review.headerTemplatePath`
- `review.bodyTemplate` / `review.bodyTemplatePath`
- `review.footerTemplate` / `review.footerTemplatePath`

> **Important caveat:** When `group-proposals: true`, the workspace-level `review` overrides are **ignored** (because there's only one PR, and the root config drives it). We should log a warning if a user defines workspace-level `review` overrides while `group-proposals: true`.

---

## Config Naming — Are `auto` and `review` too short?

**No, they are fine.** Here's why:

1. **They are namespaced under the root object.** `config.auto.triggerStrategy` and `config.review.workingBranchNameTemplate` are already clear in context.
2. **Every major tool uses short names.** GitHub Actions uses `on`, `jobs`, `steps`. Docker Compose uses `build`, `ports`. Terraform uses `resource`, `data`. Short top-level keys are the standard.
3. **Renaming would create a breaking change** without a meaningful UX improvement. The `releaseFlow` property already clarifies what "auto" and "review" mean.

The combination of `releaseFlow: "review"` + the `review: { ... }` block is perfectly unambiguous.

---

## Q3 Revisited — Side-Effect Pattern Context vs Pure Passing

**Your instinct toward purity is correct.** The global mutable singleton is the weakest architectural element in the current codebase.

### Pros of keeping the side-effect pattern (current):
- Zero refactoring cost.
- Works today for single-repo.

### Cons of keeping it for monorepo:
- Requires careful "clear and repopulate" per workspace iteration — easy to introduce bugs where stale context from workspace A leaks into workspace B.
- Makes the code harder to test (no way to unit-test template resolution without mutating global state).
- The `STRING_PATTERN_CONTEXT` global is essentially a hidden function parameter.

### Pros of making it explicit/pure:
- Each workspace gets an isolated, immutable context object.
- `resolveStringTemplate(template, context)` becomes a pure function.
- No risk of cross-workspace contamination.
- Much easier to test.

### Cons of making it explicit:
- Requires touching every call site of `resolveStringTemplate` to pass context.
- The context object must be threaded through function parameters (but you already do this with `config` and `inputs`).

**My recommendation: Go pure, but do it incrementally.**

Phase 1 (during monorepo implementation): Add an explicit `context` parameter to `resolveStringTemplate` that **falls back** to the global `STRING_PATTERN_CONTEXT` if not provided. This is backward-compatible — existing call sites keep working.

```typescript
export async function resolveStringTemplate(
  template: string,
  additionalContext?: Record<string, unknown>,
  baseContext?: Record<string, unknown>, // NEW: explicit context override
): Promise<string> {
  const effectiveContext = baseContext ?? STRING_PATTERN_CONTEXT;
  // ...
}
```

Phase 2 (future cleanup): Migrate all call sites to pass explicit context and remove the global singleton.

This avoids a massive upfront refactor while ensuring monorepo workspaces get isolated contexts.

---

## Q4–Q5 Revisited — Env Variable Format

### Should env also flatten instead of JSON object?

**Honest answer: yes, flatten is better for env.** Here's why:

1. **Shell ergonomics.** In bash/shell, accessing a flat env var is `$ZR_NEXT_VERSION_CORE`. Accessing a value from a JSON env var requires `echo $ZR_GLOBAL_NEXT_VERSION | jq -r '.core'` — which requires `jq` to be installed. Most CI environments have `jq`, but it's still friction.
2. **The JSON object approach is over-engineered.** It optimizes for a use case (programmatic parsing of all workspaces simultaneously) that most users don't need. Users typically write per-workspace `postRelease` hooks that say "deploy package X." They need `$ZR_NEXT_VERSION` for the current workspace, and maybe `$ZR_NEXT_VERSION_CORE` for a cross-workspace reference.

### The recommended env export strategy:

**Per-workspace hooks** (preCalculateVersion, postCalculateVersion, preTag, preRelease, postRelease):
- `ZR_NEXT_VERSION` = current workspace's value (e.g., `1.3.0`)
- `ZR_NAME` = current workspace's name (e.g., `core`)
- `ZR_TAG_NAME` = current workspace's tag (e.g., `core-v1.3.0`)

**Global hooks** (preRun, preCommit, postCommit, postRun):
- `ZR_NEXT_VERSION` = **undefined** (no single workspace is active)
- Flat per-workspace: `ZR__CORE__NEXT_VERSION`, `ZR__CLI__NEXT_VERSION`
- Also provide `ZR_WORKSPACES` = JSON array of all workspace summaries (for scripting convenience): `[{"name":"core","nextVersion":"1.3.0","tagName":"core-v1.3.0"}, ...]`

### Duplicate export for current workspace?

**Yes, duplicate. Keep it simple.** During `core`'s `preTag` hook, export both `ZR_NEXT_VERSION=1.3.0` AND `ZR__CORE__NEXT_VERSION=1.3.0`. The duplication is negligible and avoids users needing to know which scope they're in.

### Is `__` (double underscore) a good delimiter?

**Yes, `__` is the best choice for env vars.** It is:
- Visually distinct from single `_` word separators.
- An established convention (Docker, Kubernetes, .NET all use `__` as a namespace separator in env vars).
- Shell-safe (no special characters).

For outputs, `--` (double hyphen) mirrors this convention in kebab-case and is equally clear.

---

## FQ2 — Commit Message Template in Monorepo

### `commit` config in workspace

You're right that only `localChangesToCommit` makes sense per-workspace. The commit header/message is global (one commit for all workspaces).

### How to build the aggregate commit message

The approach of a custom LiquidJS filter is the right one. Here's the concrete design:

**New string pattern variable:**
- `workspaceReleases` — an array of objects: `[{name: "core", nextVersion: "1.3.0", tagName: "core-v1.3.0"}, ...]`

**New custom LiquidJS filter:**
- `format_workspace_releases` — formats the array into a string

**Default commit header template in monorepo mode:**
```liquid
chore: release {{ workspaceReleases | format_workspace_releases }}
```

Where `format_workspace_releases` produces: `core-v1.3.0, cli-v2.0.1`

The filter implementation:
```typescript
liquidEngine.registerFilter("format_workspace_releases", (releases: any[]) => {
  return releases.map(r => `${r.name}-v${r.nextVersion}`).join(", ");
});
```

Users can write their own format using standard Liquid:
```liquid
chore: release {% for ws in workspaceReleases %}{{ ws.tagName }}{% unless forloop.last %}, {% endunless %}{% endfor %}
```

**For single-repo**, `workspaceReleases` still exists as a 1-item array, so the default template works for both modes without branching.

### Switching defaults via schema

Use a `v.transform` step after the full config is parsed (not inside `WorkspaceMemberConfigSchema`). At the top-level config resolution, after merging workspace configs:

```typescript
// If monorepo mode and user didn't override commit.headerTemplate, apply monorepo default
if (config.workspace && !rawConfig.commit?.headerTemplate) {
  config.commit.headerTemplate = DEFAULT_MONOREPO_COMMIT_HEADER_TEMPLATE;
}
```

This keeps the schema clean and moves the "mode-aware default" logic into config resolution.

---

## FQ3 — Changelog Path: Relative to Workspace or Repo Root?

**Relative to workspace path.** Here's the careful evaluation:

### Relative to workspace path (recommended):
- **Intuitive**: A workspace at `packages/core` with `changelog.path: "CHANGELOG.md"` writes to `packages/core/CHANGELOG.md`. The user thinks in terms of "my package's changelog."
- **Portable**: If a workspace moves from `packages/core` to `libs/core`, the changelog config doesn't need to change.
- **Convention**: release-please, Changesets, and Lerna all default to placing changelogs inside the package directory.

### Relative to repo root:
- **Explicit**: No ambiguity about where the file goes.
- **Annoying**: Every workspace must write `packages/core/CHANGELOG.md` — the path is redundant since the workspace path is already `packages/core`.

### The edge case — what if user wants a root-level aggregate changelog?
They define the root package (`.`) as a workspace, and its changelog naturally goes to `./CHANGELOG.md`.

**Decision: Relative to workspace path.** Internally, when constructing the actual file path for the commit, we prepend the workspace path: `workspacePath + "/" + changelog.path`.

---

## FQ4 — `Release-As` Footer Syntax in Monorepo

### The Spec Problem

You are absolutely right. The Conventional Commits spec states footer tokens must only contain **word characters and hyphens**. A workspace name like `@scope/pkg` or `my.pkg` would break the parser.

Even `Release-As-core` technically works (alphanumeric + hyphens), but if a user names their workspace `my-lib`, then `Release-As-my-lib: 2.0.0` is ambiguous — is the token `Release-As-my-lib` or `Release-As-my` with `-lib` as part of the value?

### The Right Solution

Move the workspace targeting to the **value side** of the footer, not the token side. Use a single token `Release-As` with a structured value:

**Syntax:**
```
Release-As: <name>@<version>, <name>@<version>
```

**Examples:**
```
Release-As: core@2.0.0
Release-As: core@2.0.0, cli@3.0.0
Release-As: 2.0.0
```

**Rules:**
1. `Release-As: <version>` (no `@`) — applies to all workspaces (monorepo) or the single package (single-repo). This is backward-compatible with the current behavior.
2. `Release-As: <name>@<version>` — applies to the named workspace only.
3. `Release-As: <name>@<version>, <other>@<version>` — comma-separated for multiple workspaces.
4. If both a global `Release-As: 2.0.0` and a specific `Release-As: core@3.0.0` exist in the same commit, the specific one overrides the global for `core` only.

**Why `@`?** It is a standard "targeting" symbol (npm `@scope/pkg@version`, Docker `image@digest`, email `user@domain`). It is allowed in Conventional Commit footer values (the spec only restricts the token/key, not the value). And it is unambiguous — workspace names cannot contain `@` (we enforce this via schema validation).

---

## FQ5 — Implementation Phasing

Agreed. Features that are useful standalone should ship first:

**Pre-monorepo features (separate PRs):**
1. `tag.matchPatterns` + refactor of `listCommitsFromGivenToLastRelease` into `findLastReleaseCommitHash` + `listCommitsInRange`
2. Remove `getLatestRelease` and `parseLooseSemVer` from commit resolution
3. `review.groupProposals` schema property (default `true`, only takes effect in monorepo — but the schema should exist beforehand)

---

## FQ6 — Commit Fetching Architecture (Critical Decision)

The other AI's analysis is **substantially correct** and changes the architecture significantly. Let me evaluate each point honestly:

### Point 1: The N+1 API Trap — **Correct.**

My original proposal to add `getChangedFilesForCommit` is indeed the classic N+1 anti-pattern for an API-first tool. For 50 commits, that's 50 additional API calls just to check file paths. This is unacceptable.

### Point 2: The "Furthest Tag" Global Fetch — **Partially correct, but overstated.**

The "dead package" scenario (pkg-A not updated in 2 years) is a real concern, but the claim that it forces "2 years of history" is mitigated by `maxCommitsToResolve` (default: 100). The tool would fetch at most 100 commits, not 2 years. However, the fundamental critique is valid: fetching a global unfiltered list and then trying to figure out which files each commit touched is architecturally wrong for an API-first tool.

### Point 3: The Parallel Path Loop — **This is the correct architecture.**

The GitHub `listCommits` API with `?path=packages/core` does the filtering **server-side**. This is objectively superior because:
1. **GitHub's database index does the work** — it's faster than any client-side filtering.
2. **Only relevant commits are returned** — no wasted bandwidth or rate limit burns.
3. **No N+1 problem** — you get exactly the commits you need in 1 paginated call per workspace.
4. **Naturally parallelizable** — `Promise.all` across workspaces.

### Updated Architecture

```
1. GET /repos/{owner}/{repo}/tags → filter by matchPatterns → Map<workspaceName, lastReleaseHash>
   (1 paginated API call)

2. FOR EACH workspace (parallel via Promise.all):
   GET /repos/{owner}/{repo}/commits?sha=triggerHash&path=packages/core
   → paginate until we hit workspace's lastReleaseHash
   → collect commits
   (1 paginated API call per workspace)

3. Parse, filter by commit type, generate VersionBumpIntents
```

Total API calls: 1 (tags) + N (commits per workspace) = N+1 calls, where N is the number of workspaces. For a 10-workspace monorepo, that's 11 API calls. Compare this to the global-fetch approach which would be 1 (tags) + 1 (global commits) + 50 (per-commit file inspection) = 52 calls.

### What about `source-mode: local`?

For local mode, the original approach (global fetch + `git diff-tree` per commit) is fine because local git operations are instant. But for API mode, the path-filtered approach is mandatory.

**Decision:** The provider interface for `listCommitsFromGivenToLastRelease` (or its refactored successor) must accept an optional `path` parameter. The GitHub implementation passes it as a query param. A local-git implementation can use `git log -- <path>` which also supports path filtering natively.

---

## Updated Provider Interface Proposal

Based on all decisions above, here is the new provider method signature:

```typescript
// Replace listCommitsFromGivenToLastRelease with:

/**
 * Find the commit hash of the last release by matching tags.
 * @param matchPatterns - glob patterns to match against tag names
 * @param maxTagsToScan - limit for how many tags to scan
 */
findLastReleaseHash(
  matchPatterns: string[],
  maxTagsToScan?: number,
): Promise<{ hash: string; tagName: string } | undefined>;

/**
 * List commits from a starting point, optionally filtered by path.
 * @param fromHash - commit hash to start walking from
 * @param stopHash - commit hash to stop at (exclusive)
 * @param path - optional directory path filter (for monorepo workspace filtering)
 * @param maxCommits - maximum number of commits to return
 */
listCommitsInRange(
  fromHash: string,
  stopHash?: string,
  path?: string,
  maxCommits?: number,
): Promise<ProviderCommit[]>;
```

---

## Summary of All Confirmed Decisions

| Topic | Decision |
|-------|---------|
| Tag resolution | Drop `getLatestRelease`. Use `tag.matchPatterns` + auto-derived pattern for both single-repo and monorepo |
| `review` in workspace | Include (with select omissions: labels, assignees, reviewers) |
| `auto` and `review` naming | Keep as-is, no rename needed |
| `initialVersion` | Per-workspace |
| String pattern context | Incremental move toward pure: add explicit context parameter to `resolveStringTemplate`, fall back to global |
| Env variables | Flatten per-workspace (`ZR__CORE__NEXT_VERSION`), `ZR_NEXT_VERSION` = current workspace in per-ws hooks, `ZR_WORKSPACES` = JSON summary in global hooks |
| Output variables | `zr--core--next-version` (monorepo), `zr-next-version` (single-repo only) |
| `__` / `--` delimiters | Confirmed |
| Commit message | New `workspaceReleases` pattern + `format_workspace_releases` filter. Default auto-switches in monorepo |
| Changelog path | Relative to workspace path |
| Release-As syntax | `Release-As: core@2.0.0, cli@3.0.0` (value-side targeting with `@`) |
| Commit fetching | Path-filtered per-workspace API calls (parallel). Drop N+1 file inspection |
| Provider refactor | Split into `findLastReleaseHash` + `listCommitsInRange` with optional `path` param |
| Implementation phasing | Tag matching + provider refactor as standalone features before monorepo |

---

## Remaining Questions

### RQ1: Workspace name validation

Since workspace names are now used in env vars (`ZR__CORE__NEXT_VERSION`), output keys (`zr--core--next-version`), `Release-As` footers (`core@2.0.0`), and tag patterns (`core-v1.3.0`), we need to restrict what characters are allowed.

**My recommendation:** Validate workspace `name` to only allow: `[a-z0-9]` and single hyphens (no leading/trailing hyphens, no consecutive hyphens). Essentially the same rules as npm package names (without scopes).

This prevents:
- Names with `@` (would break `Release-As` parsing)
- Names with `__` (would break env var parsing)
- Names with `--` (would break output key parsing)
- Names with uppercase (inconsistent across case-sensitive/insensitive filesystems)

Do you agree, or do you want to allow more characters?

### RQ2: Are there any remaining open questions?

I believe we now have concrete answers for every architectural decision. If you agree, I'm ready to write the **final, file-level implementation plan**.

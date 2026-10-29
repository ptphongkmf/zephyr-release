# Pre-Implementation Questions — Final Clarifications Before Writing the Full Plan

> **Date:** 2026-05-26  
> **Purpose:** Questions I need answered before writing the complete, file-level implementation plan for monorepo support.

---

## Q1: Commit Resolution — "Last Release" per Workspace

This is the single most impactful architectural question.

Currently, `listCommitsFromGivenToLastRelease` (in `providers/github/commit.ts`) resolves commits by walking backwards from the trigger commit until it hits:
1. The **latest GitHub Release** (via `repos.getLatestRelease`), or
2. A **coerced SemVer tag** (fallback), or
3. The `resolveUntilCommitHash` override.

This works because in single-repo mode, there is **one** "latest release" for the entire repo.

In monorepo, each workspace has its **own** latest release tag (e.g., `core-v1.2.0`, `cli-v2.0.1`). The global "latest release" from GitHub's API (`getLatestRelease`) returns only **one** release — whichever was most recently published. This means:

- If `core` was released 2 days ago and `cli` was released today, `getLatestRelease` returns `cli-v2.0.1`.
- Walking back from the trigger commit to `cli-v2.0.1` would miss all commits between `core-v1.2.0` and `cli-v2.0.1` that are relevant to `core`.

**My proposed approach:**
- In monorepo mode, we **do NOT use** `getLatestRelease` or the generic coerced-tag fallback.
- Instead, for each workspace, we resolve the tag name using its `tag.nameTemplate` pattern (e.g., `core-v*`), and use the GitHub API to find the latest tag **matching that pattern** to determine the per-workspace "last release" commit.
- The raw commit list is fetched **once** globally (from trigger to the oldest workspace's last release), and then **filtered per workspace** by path.

**Question:** Does this approach align with how you expect it to work? Or do you have a different idea for how "since last release" should be scoped per workspace?

---

## Q2: Per-Workspace `auto.triggerStrategy` Overrides

In `impl-5.md` I noted that per-workspace `auto.triggerStrategy` overrides would be "extremely powerful." But the `auto` config block is currently omitted from workspace member configs (per `impl-3.md`, workspaces cannot define their own `auto` or `review` settings).

Do you want to:
- **A)** Keep `auto` and `review` entirely global (simpler, cleaner) — workspaces inherit everything from root.
- **B)** Allow `auto.triggerStrategy` to be overridden per workspace (while keeping `releaseFlow` global). This would let `packages/core` buffer 5 fixes before releasing while `packages/api` releases instantly.

This is a meaningful UX and complexity decision. Option B adds another layer of config merging but is much more powerful for real-world monorepos.

---

## Q3: String Pattern Context — Global or Per-Workspace?

Currently, the string pattern context (`STRING_PATTERN_CONTEXT`) is a **global mutable singleton**. Templates like `{{ nextVersion }}`, `{{ name }}`, `{{ tagName }}`, `{{ changelogRelease }}` are set once and resolved globally.

In monorepo, each workspace iteration has its **own** `nextVersion`, `name`, `tagName`, and `changelogRelease`. This means the global singleton must be **reset and rebuilt per workspace iteration**.

**My proposed approach:**
- Before processing each workspace, clear the workspace-specific patterns (`name`, `currentVersion`, `nextVersion`, `tagName`, `changelogRelease`, `changelogReleaseBody`, etc.) from the context and repopulate them with the current workspace's values.
- Keep the "fixed base" patterns (`host`, `namespace`, `repository`, `triggerBranchName`, datetime patterns) set once at bootstrap.

**Question:** Are you comfortable with this "clear and repopulate per iteration" approach? Or would you prefer refactoring the pattern context into an instance-based (non-singleton) design? The latter is cleaner but is a larger refactor.

---

## Q4: Command Hooks in Monorepo — Execution Scope

Currently, command hooks (`preRun`, `preCalculateVersion`, `preCommit`, `postCommit`, `preTag`, `preRelease`, `postRelease`, `postRun`) run **once** per operation.

In monorepo with the "loop-over-workspaces" model, when do hooks fire?

**Option A: Hooks run once globally (outside the workspace loop)**
- `preRun` runs once at the start.
- The workspace loop runs (calculate versions, generate changelogs, prepare files for ALL workspaces).
- `preCommit` runs once before the single atomic commit.
- `postCommit` runs once after the commit.
- `preTag`/`preRelease`/`postRelease` run once... but for which workspace? Tags and releases are per-workspace.

**Option B: Some hooks run per workspace, some globally**
- `preRun` / `postRun` → global.
- `preCalculateVersion` / `postCalculateVersion` → per workspace (since each workspace calculates its own version).
- `preCommit` / `postCommit` → global (since we do one atomic commit).
- `preTag` / `preRelease` / `postRelease` → per workspace (since each workspace gets its own tag/release).

Option B is more useful but introduces a behavioral change for hooks. It also means the environment variables exported at each hook phase would need to reflect the current workspace.

**Question:** Which approach do you prefer?

---

## Q5: Exported Variables in Monorepo

Currently, variables like `ZR_NEXT_VERSION`, `ZR_CURRENT_VERSION`, `ZR_TAG_NAME` are singular scalars.

In monorepo, we need to expose per-workspace data. Options:

**Option A: JSON aggregate variable**
```
ZR_WORKSPACES='[{"name":"core","nextVersion":"1.3.0","tagName":"core-v1.3.0"}, ...]'
```
Users parse the JSON in their CI scripts.

**Option B: Per-workspace flat variables**
```
ZR_NEXT_VERSION_CORE="1.3.0"
ZR_NEXT_VERSION_CLI="2.0.0"
ZR_TAG_NAME_CORE="core-v1.3.0"
```

**Option C: Both**

**Question:** Which approach do you prefer? Option A is cleaner and more extensible, but Option B is more ergonomic for simple cases.

---

## Q6: `review.workingBranchNameTemplate` in Monorepo with `group-proposals: false`

When proposals are grouped (`group-proposals: true`), there is one working branch (e.g., `zephyr-release/proposal`). This is identical to the current single-repo behavior.

When proposals are **not** grouped (`group-proposals: false`), each workspace needs its **own** working branch (e.g., `zephyr-release/core`, `zephyr-release/cli`). The `workingBranchNameTemplate` currently resolves to a single branch name.

**My proposed approach:**
- When `group-proposals: false`, automatically append `/{{ name }}` (or similar) to the working branch template to generate per-workspace branches.

**Question:** Is this acceptable, or do you want more granular control over per-workspace branch naming?

---

## Summary

| # | Topic | Impact |
|---|---|---|
| Q1 | Per-workspace "last release" tag resolution | **Critical** — changes provider interface |
| Q2 | Per-workspace `auto.triggerStrategy` overrides | Medium — affects config schema |
| Q3 | String pattern context reset strategy | Medium — affects template engine |
| Q4 | Hook execution scope (global vs per-workspace) | **High** — behavioral change |
| Q5 | Exported variable format | Medium — affects downstream CI |
| Q6 | Per-workspace branch naming | Low — only for `group-proposals: false` |

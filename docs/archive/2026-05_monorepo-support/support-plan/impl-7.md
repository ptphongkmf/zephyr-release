# Monorepo Support — Evaluation of Answers & Follow-Up Questions (Draft 7)

> **Status:** Draft / Critical Review  
> **Date:** 2026-05-28  
> **Purpose:** Evaluate answers from `impl-6-answer.md`, answer your embedded questions, and raise unresolved points that need concrete decisions before the final implementation plan.

---

## Evaluation of Q1 — Per-Workspace "Last Release" Resolution

### Your Ideas — Evaluated

**1. "Create a regex from `nameTemplate`"**
LiquidJS does **not** have any built-in utility to reverse a template into a regex. It is purely a rendering engine (template → string). We would have to build this ourselves.

The approach would be:
- Take `nameTemplate` (e.g., `{{ name }}-v{{ nextVersion }}`)
- Replace every `{{ ... }}` token with a capture group: `(.+)-v(.+)`
- Use this regex to match against the list of remote tags

This is straightforward to implement. We can write a simple `templateToMatchPattern(template: string): RegExp` utility that replaces all `{{ ... }}` occurrences with `(.+?)` (non-greedy) and escapes the literal parts. No LiquidJS involvement needed.

**2. "Add a previous/fallback name template property"**
This is a **genuinely good idea**, and yes, it should be implemented as a standalone feature before monorepo.

However, I'd push back slightly on the framing. The property shouldn't be about "old" or "previous" — it should be about **tag matching**. The `nameTemplate` defines what Zephyr *creates*. But what it *searches for* to find the last release could be different (especially during migrations).

### Naming Recommendation

Between your options:
- ❌ `latestNameTemplate` — confusing ("latest" could mean "the newest tag" or "the most recent template")
- ❌ `previousNameTemplate` / `oldNameTemplate` / `beforeNameTemplate` — implies it's a one-time migration hack, not a permanent feature
- ⚠️ `fallback-name-template` — better, but "fallback" implies it's only used when the primary fails
- ✅ `fallback-match-patterns` — close, but "match-patterns" sounds like a generic filter

**My recommendation: `tag.matchPatterns`** (array of glob strings)

Reasoning:
1. It lives under `tag` where it logically belongs (alongside `nameTemplate`).
2. It is an **array of globs**, not templates. Templates would require the full LiquidJS context to be available during tag search, which creates a chicken-and-egg problem (you need the version to resolve the template, but you need the template to find the version). Globs like `v*`, `core-v*` are simple, stateless, and match directly against tag names.
3. The `nameTemplate` is automatically converted to a match pattern as well (via `templateToMatchPattern()`), so `matchPatterns` is purely **additional** patterns, not a replacement.

```json
{
  "tag": {
    "nameTemplate": "{{ name }}-v{{ nextVersion }}",
    "matchPatterns": ["v*", "core/v*"]  // optional, for migration from old naming
  }
}
```

If `matchPatterns` is not provided, the system auto-derives a pattern from `nameTemplate`. If it is provided, the system uses both the auto-derived pattern AND the explicit patterns.

### Should we use globs or templates?

**Globs.** Using templates here would mean the pattern depends on runtime context (`{{ name }}`, `{{ nextVersion }}`). But `nextVersion` is precisely what we're trying to *find* by locating the last release tag. You can't use the output to find the input. Globs (`core-v*`) are context-free and match directly.

### Should we remove `parseLooseSemVer` and the `getLatestRelease` API call?

**Yes to removing `parseLooseSemVer`.** The tag matching should be pattern-based, not "coerce anything that vaguely looks like a semver." The coercion is fragile and can match tags that aren't releases (e.g., `test-v0.1`).

**Partially yes to removing `getLatestRelease`.** Here's my recommendation:
- **Single-repo:** Keep `getLatestRelease` as the *primary* resolution method (it's fast, 1 API call). Use `tag.matchPatterns` + `templateToMatchPattern(nameTemplate)` as the fallback when there are no GitHub Releases (some repos only use tags, no releases).
- **Monorepo:** Do **not** use `getLatestRelease` (it only returns one global release). Use `tag.matchPatterns` exclusively.

This gives single-repo users the best of both worlds (fast happy path, robust fallback), while monorepo gets the correct per-workspace behavior.

### Should we refactor into separate methods?

**Absolutely yes.** `githubListCommitsFromGivenToLastRelease` currently does two things: (1) find the "stop point" hash, and (2) walk commits. These should be split:

```
findLastReleaseCommitHash(workspace?: WorkspaceContext): Promise<string | undefined>
listCommitsInRange(fromHash: string, toHash?: string, maxCommits: number): Promise<ProviderCommit[]>
```

This makes the provider interface cleaner and monorepo-ready.

### Optimization — Avoiding Duplicate Fetches

Your instinct is correct. The optimal approach:

1. For each workspace, resolve its "last release" tag → commit hash.
2. Find the **oldest** (furthest back in history) of all those hashes. Call this `globalStopHash`.
3. Fetch commits **once**: from `triggerCommitHash` to `globalStopHash`.
4. For each workspace, **slice** this global list: take commits from the start until that workspace's specific stop hash.
5. Then **filter by path** within each workspace's slice.

This reduces N API fetches to 1, which is critical for monorepos with 20+ packages.

---

## Evaluation of Q2 — Per-Workspace `auto.triggerStrategy`

**Your answer is correct.** Per-workspace trigger strategies are orthogonal to release flow. A changeset-based system would use an entirely different detection mechanism (reading `.changeset` files), so whether `auto.triggerStrategy` is per-workspace doesn't affect future changeset design at all.

**Decision confirmed:** Allow `auto.triggerStrategy` to be overridden per workspace.

This means the `auto` block should NOT be fully omitted from `WorkspaceMemberConfigSchema`. Instead:
- Omit `releaseFlow` (global).
- Omit `review` (global — working branch, proposal templates, etc.).
- **Include** `auto.triggerStrategy` (per-workspace override allowed).

---

## Evaluation of "Before Q3–Q5" — Architecture & Config

### Workspace Member Schema — Which properties go where?

Here is my proposed split. Tell me if you disagree with any:

**GLOBAL ONLY (omitted from workspace member config):**
- `releaseFlow` — must be global
- `review` — proposal templates, working branch, labels, assignees, reviewers (all scoped to the single proposal lifecycle)
- `commandHooks` — hooks are either global or per-workspace at the *execution* level, not at the *config* level (more on this below)
- `runtimeConfigOverride` — global lifecycle mechanism
- `maxCommitsToResolve` — global commit window
- `resolveUntilCommitHash` — global commit window override
- `timeZone` — global display setting
- `customStringPatterns` — global template context
- `initialVersion` — (debatable, see follow-up question below)

**PER-WORKSPACE (included in workspace member config, all optional, inheriting from root):**
- `name` — **required** in workspace
- `versionFiles` — per-workspace version files
- `commitTypes` — per-workspace commit type filtering
- `allowedReleaseAsCommitTypes` — per-workspace release-as filtering
- `bumpStrategy` — per-workspace bump rules
- `changelog` — per-workspace changelog path, templates
- `commit` — per-workspace commit message template (for the scoped section)
- `tag` — per-workspace tag naming, type, tagger
- `release` — per-workspace release title, body, assets
- `auto` — per-workspace trigger strategy only (as decided in Q2)

> **Follow-up question:** Should `initialVersion` be per-workspace? If a new workspace is added to an existing monorepo, it starts at `0.1.0` (or whatever `initialVersion` is). If different workspaces want different initial versions, it needs to be per-workspace. I think **yes, per-workspace**, but confirm.

### Release Context Array — Your Architectural Idea

Your idea: *"On bootstrap, create a release context array. Even for single repo, we create a 1-item array to normalize the shape. Then in workflows, wrap tasks in jobs (a new `src/jobs` folder) that loop through the array."*

**I agree with the normalized array approach. I disagree with creating a `src/jobs` folder.**

Here's why: You already have a clean separation — `src/workflows/` orchestrates the flow, `src/tasks/` contains the individual operations. Adding a `src/jobs/` layer between them creates a third abstraction that exists solely to loop. This is unnecessary indirection.

**My counter-proposal:**
- Keep `src/workflows/auto.ts` and `src/workflows/review.prepare.ts` as the orchestrators.
- Inside those workflows, introduce a `for...of workspaceContexts` loop directly. The loop body calls the same task functions (`getCurrentVersion`, `calculateNextVersion`, `generateChangelog`, etc.) but with per-workspace config.
- Extract the "prepare one workspace" logic into a helper function within the workflow file (e.g., `prepareWorkspace(provider, workspace, ...)`) to keep the main function clean.

This keeps the architecture two-tier (workflows → tasks) instead of three-tier (workflows → jobs → tasks), which is simpler to reason about.

**However**, if you feel strongly about `src/jobs/`, I won't block it. It's a stylistic choice. The critical thing is: the loop must be inside the orchestrator, not inside individual tasks.

### Distinguishing Single-Repo vs Monorepo with 1 Package

Your idea of a boolean to know if it's "truly single repo" vs "monorepo with 1 affected package" is correct.

**My recommendation:** Put a `isMonorepoMode: boolean` flag on the **root run settings** (or `OperationRunSettings`), not inside each context item. Reasoning:
- It's a property of the *repository configuration*, not the *workspace*.
- You set it once during config parsing (`isMonorepoMode = config.workspace !== undefined`).
- In the loop, you check `if (isMonorepoMode) { logWorkspaceHeader(workspace.name); }`.

### Multiple Paths Per Package

Your idea: *"Should we support multiple paths for 1 pkg? Switch from `<path>: {...}` to `<name>: {paths: [], ...}`?"*

**No. This is wrong from the root.**

A workspace in a monorepo maps 1:1 with a directory. That is the fundamental model of every monorepo tool (npm workspaces, pnpm, Lerna, Nx, release-please, Changesets — all use a single path per package).

If a user has code spread across multiple directories that should release as one unit, the correct solution is:
- Restructure the code so it lives in one directory, or
- Use a root-level package (`.`) with explicit `zephyr-include` footers.

Supporting multi-path per workspace would break the fundamental assumption that "path filtering = workspace membership" and add massive complexity to commit filtering logic.

**Keep the current `<path>: {...config}` structure.**

---

## Evaluation of "Short-Circuit" — `validateCurrentOperationTriggerCtx`

### Should we keep it?

**Yes, keep the bot-commit check** (`ZEPHYR_RELEASE_COMMIT_SIGN`). It's the infinite loop guard. In monorepo mode, it still works correctly because the sign is on the commit, not per-workspace.

**Yes, keep the `commitHasAllowedType` check.** But its behavior changes slightly:
- In single-repo, if the trigger commit has no allowed type, we currently continue (for review mode to check if it's a merged proposal) or log-and-continue (auto mode).
- In monorepo, the trigger commit might not have an allowed type for *some* workspaces but may have relevant path-filtered commits for others. The short-circuit should still only check the **trigger commit** (latest push), not the full history. If the trigger commit is a bot commit → abort globally. If it has no allowed type → continue to resolve full history (because older unreleased commits in the range might affect workspaces).

### How to determine the "affected packages" array

Your question: *"Should we judge based on trigger commit? But what if old commits failed and are now being picked up?"*

**The correct approach:**

1. **Do NOT determine affected packages from the trigger commit alone.** This is wrong precisely for the reason you identified — old failed commits would be missed.
2. Instead:
   - Resolve the commit range for each workspace (trigger → that workspace's last release tag).
   - For each workspace, get the changed files within that commit range.
   - If any files fall within the workspace's path → the workspace is "affected."
3. Using the optimization from Q1:
   - Find the `globalStopHash` (the oldest of all per-workspace last-release hashes).
   - Fetch the full commit range once (trigger → `globalStopHash`).
   - For each workspace, slice to its specific stop hash, then filter by path.
   - If the filtered result is non-empty → workspace is affected → add to the release context array.

This is the only correct approach. It is robust against failed CI runs, force-pushes, and any other scenario where older commits need to be picked up.

---

## Evaluation of Q3 — String Pattern Context

**Your answer is correct and clean.**

The pattern context will be a `Map<workspaceName, Record<string, unknown>>`. Before processing each workspace, we set the "current workspace context" as the active context for template resolution.

One implementation detail: the global/fixed patterns (host, namespace, repository, triggerBranchName, timestamps) are shared across all workspaces and set once. The per-workspace patterns (name, currentVersion, nextVersion, tagName, changelog*) are set per iteration.

**Proposed implementation:**
```typescript
// In pattern-context.ts, add:
const WORKSPACE_CONTEXTS = new Map<string, Record<string, unknown>>();

export function setActiveWorkspaceContext(workspaceName: string) {
  const wsCtx = WORKSPACE_CONTEXTS.get(workspaceName) ?? {};
  // Overlay workspace-specific values over the global built-in context
  Object.assign(BUILT_IN_CONTEXT, wsCtx);
  Object.assign(STRING_PATTERN_CONTEXT, CUSTOM_CONTEXT, BUILT_IN_CONTEXT);
}
```

---

## Evaluation of Q4 + Q5 — Hooks & Exported Variables

### Hooks — Per-workspace vs Global

Agreed. Here's the concrete split:

| Hook | Scope | Reasoning |
|------|-------|-----------|
| `preRun` | Global | Runs before any workspace processing |
| `preCalculateVersion` | Per workspace | Each workspace calculates its own version |
| `postCalculateVersion` | Per workspace | Version is workspace-specific |
| `preCommit` | Global | One atomic commit for all workspaces |
| `postCommit` | Global | Commit is global |
| `postProposal` | Global | One proposal (if grouped) |
| `preTag` | Per workspace | Each workspace gets its own tag |
| `preRelease` | Per workspace | Each workspace gets its own release |
| `postRelease` | Per workspace | Release is workspace-specific |
| `postRun` | Global | Final cleanup |

### Exported Variables — Env vs Output Split

Your design is sound. Let me confirm I understand correctly:

**Environment Variables (flat, SCREAMING_SNAKE_CASE):**
- Per-workspace scope: `ZR_NEXT_VERSION` is set to the *current* workspace's value during that workspace's hook execution.
- Global aggregate: `ZR_GLOBAL_NEXT_VERSION` = `{"core": "1.3.0", "cli": "2.0.1"}` (stringified JSON).
- In single-repo: `ZR_GLOBAL_NEXT_VERSION` = `{"my-app": "1.3.0"}` (using root `name`, or `"root"` if undefined).

**Outputs (kebab-case, platform-specific like GitHub Actions step outputs):**
- Monorepo: `zr--core--next-version`, `zr--cli--next-version`
- Single-repo: `zr-next-version` (unchanged from current behavior)
- In monorepo, `zr-next-version` (without namespace) does NOT exist / is undefined.

> **Follow-up question:** The `--` delimiter in `zr--core--next-version` could be ambiguous if a workspace name contains hyphens (e.g., `my-lib` → `zr--my-lib--next-version`). Should we use a different delimiter? Options:
> - `zr--my-lib--next-version` (current proposal — visually clear despite hyphens in name)
> - `zr_my-lib_next-version` (underscore separation — ugly mixing)
> - `zr.my-lib.next-version` (dot separation — GitHub Actions doesn't support dots in output names)
>
> I think `--` is actually the best option. The double-hyphen is visually distinct enough. Confirm?

---

## Evaluation of Q6 — Working Branch Naming

**Your approach is correct.**

In `WorkspaceMemberConfigSchema`, `review.workingBranchNameTemplate` will be re-introduced with a new default: `zephyr-release/{{ name }}/{{ triggerBranchName }}`.

Since `{{ name }}` is required and unique per workspace, this guarantees unique branch names per workspace when `group-proposals: false`.

---

## Evaluation of "last" — Documentation Structure

Agreed completely. Summary of the plan:
- `docs/config-options.md` mentions `workspace` briefly with a type reference, then links to `docs/workspace-config-options.md`.
- `docs/workspace-config-options.md` is a full reference document for workspace member config, structurally similar to `config-options.md`.

---

## New Follow-Up Questions

### FQ1: `initialVersion` — Global or Per-Workspace?

Should a workspace be able to set its own `initialVersion`? Useful when adding a new package to an existing monorepo (e.g., start `packages/new-thing` at `1.0.0` instead of `0.1.0`).

### FQ2: `commit` config in workspace — What exactly is scoped?

Currently `commit` controls the commit message template (`headerTemplate`). In monorepo, there is ONE commit. Should the workspace-level `commit` config control something else, like the "section" of the commit message that describes this workspace's changes? Or should `commit` be global-only?

Example of a monorepo commit message:
```
chore: release core-v1.3.0, cli-v2.0.1

Zephyr-Release: 0.5.0
```
How should this template be constructed? The header needs to aggregate all workspace names/versions. This feels like it should be global, not per-workspace.

### FQ3: `changelog.path` in workspace — Relative to what?

When a workspace specifies `changelog: { path: "CHANGELOG.md" }`, is this relative to the **workspace path** (e.g., `packages/core/CHANGELOG.md`) or relative to the **repository root**?

My recommendation: Relative to **workspace path**. So a workspace at `packages/core` with `changelog.path: "CHANGELOG.md"` writes to `packages/core/CHANGELOG.md`. If the user wants a root-level changelog, they use `changelog.path: "../../CHANGELOG.md"` or an absolute repo path.

### FQ4: `release-as` Footer in Monorepo — Confirm Syntax

In `impl-2.md` we designed `Release-As-<name>: 2.0.0`. Is this still your preferred syntax? And what happens to the un-namespaced `Release-As: 2.0.0` in monorepo mode — does it apply to ALL workspaces, or is it ignored/an error?

### FQ5: `tag.matchPatterns` Implementation Timing

You mentioned implementing the `tag.matchPatterns` feature **before** monorepo (as a standalone single-repo feature). Should I create a separate implementation plan for this feature first, and then build monorepo on top of it? Or should it be part of the monorepo implementation plan as "Phase 1"?

### FQ6: Provider Interface — `getChangedFilesForCommit`

To do path-based commit filtering, we need to know which files each commit touched. The current `ProviderCommit` type does NOT include changed files. We need to add either:
- **A)** A new method `getChangedFilesForCommit(hash: string): Promise<string[]>` to the provider interface.
- **B)** Enrich `ProviderCommit` with an optional `changedFiles?: string[]` field, populated during commit listing.
- **C)** Use `git diff-tree --no-commit-id --name-only -r <sha>` locally (only works in `source-mode: local`).

For `source-mode: remote`, we'd need the GitHub API (`GET /repos/{owner}/{repo}/commits/{sha}` includes `files[].filename`).

**My recommendation:** Option A (new provider method). It's clean, doesn't bloat `ProviderCommit`, and can be implemented differently per provider. But it does mean one API call per commit in remote mode. With the optimization from Q1 (fetch commits once, then filter), we'd need the changed files for each commit in the range. For a range of 50 commits, that's 50 API calls.

An alternative optimization: use the GitHub Compare API (`GET /repos/{owner}/{repo}/compare/{base}...{head}`) which returns all changed files in a range up to 300 files. But this doesn't tell you *which* commit changed *which* file — only the aggregate.

**Question:** Do you have a preference here? Or should we start with per-commit API calls and optimize later?

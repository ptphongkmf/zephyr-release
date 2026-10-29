# Monorepo Support — Final Clarifications (Draft 9)

> **Status:** Final Pre-Implementation Review  
> **Date:** 2026-05-29  
> **Purpose:** Resolve the last remaining questions from `impl-8-answer.md`. After this document, we should have zero open questions and can proceed to the full implementation plan.

---

## Q2 — Labels, Reviewers, Assignees in Workspace

You're right, they are simple. I was being overly conservative.

**Updated decision: Include labels, reviewers, and assignees in workspace `review` config.** The full `review` object is now available per-workspace without any omissions.

### Valibot Variant for `group-proposals` Conditional Schema

Using a Valibot `v.variant` to make the schema conditionally require/forbid workspace-level `review` fields based on `group-proposals` is theoretically clean, but **practically a bad idea** because:

1. **`toJsonSchema` does support `oneOf`/`anyOf`** from Valibot variants, but the resulting JSON Schema is extremely verbose and confusing for users reading it in their IDE.
2. **It couples two unrelated config locations** — `review.groupProposals` (root-level) would dictate the shape of `workspace.*.review` (nested). Valibot variants work best when the discriminator is in the same object.

**My recommendation: Don't use variant. Just include the full `review` block in workspace config unconditionally.** If the user sets workspace-level `review` overrides while `group-proposals: true`, the tool simply **ignores them and logs a warning** at config resolution time. This is simpler, produces a clean JSON Schema, and is standard practice (Kubernetes does the same — many fields are silently ignored when they don't apply to the current mode).

---

## Q3 — Pure Context Refactor Timing

Yes, implement it before monorepo. It benefits single-repo by making template resolution testable and side-effect-free.

**Ordering:** It should be **early** in the pre-monorepo implementation list, because the monorepo workspace loop depends on passing isolated contexts. If we refactor this last, we'd have to write the monorepo loop against the old mutable singleton and then immediately rewrite it.

**Proposed pre-monorepo implementation order:**
1. `tag.matchPatterns` + provider refactor (`findLastReleaseHash` + `listCommitsInRange`)
2. Pure context refactor (add explicit `context` parameter to `resolveStringTemplate`)
3. `releaseFlow` rename (already done ✅)
4. `review.groupProposals` schema property (during monorepo, as you said — it makes no sense for single-repo)

---

## Q4–Q5 — Cross-Workspace Variables in Per-Workspace Hooks

Understood. **All `ZR__<name>__*` variables are exported in ALL hooks** — both global and per-workspace. The only difference is that `ZR_NEXT_VERSION` (without namespace) is set to the current workspace's value during per-workspace hooks, and is undefined during global hooks.

So during `core`'s `preTag` hook, the env would contain:
```
ZR_NEXT_VERSION=1.3.0           # current workspace shortcut
ZR_NAME=core                    # current workspace name
ZR__core__NEXT_VERSION=1.3.0    # namespaced (also accessible)
ZR__cli__NEXT_VERSION=2.0.1     # other workspace
ZR_WORKSPACES=[...]             # JSON summary of all
```

---

## FQ2 — Per-Workspace Commits

### Can each workspace commit individually?

Looking back at our decisions in `impl-2.md` (Decision 4: Commit Strategy), we agreed on **single commit for all workspaces**. This was the recommendation because:
1. Avoids Git push serialization issues.
2. Tags can all point to the same commit (release-please does this).
3. Simpler, fewer failure states.

However, since `group-proposals: false` already creates per-workspace branches/PRs, **per-workspace commits naturally happen in that mode** — each workspace's branch has its own commit. The "single commit" rule only applies when `group-proposals: true` (grouped mode) and in `auto` mode.

**Decision:**
- `group-proposals: true` (or `auto` mode): **One commit** containing all workspace changes. Commit message is global (`commit.headerTemplate` from root config).
- `group-proposals: false`: **One commit per workspace branch.** Each workspace can use its own `commit.headerTemplate` from its workspace config.

This means `commit.headerTemplate` should be **included** in workspace config. In grouped mode, the workspace-level override is ignored (same as `review` overrides). In per-workspace mode, it's used.

### Commit Message Default — Unified Template

Your idea of a single unified default using the `format_workspace_releases` filter is the cleanest approach:

**Default `commit.headerTemplate`:**
```liquid
chore: release {{ workspaceReleases | format_workspace_releases }}
```

The `format_workspace_releases` filter behavior:
- **Single-repo** (`isMonorepoMode: false`): `workspaceReleases` is `[{name: "my-app", nextVersion: "1.3.0", ...}]`. The filter outputs just `v1.3.0`.
- **Monorepo** (`isMonorepoMode: true`): The filter outputs `core-v1.3.0, cli-v2.0.1`.

So the filter internally checks the `isMonorepoMode` flag (or simply checks array length / the `isWorkspace` boolean you suggested) to decide the format:

```typescript
liquidEngine.registerFilter("format_workspace_releases", (releases: any[]) => {
  if (releases.length === 1 && !releases[0].isWorkspace) {
    return `v${releases[0].nextVersion}`;
  }
  return releases.map(r => `${r.name}-v${r.nextVersion}`).join(", ");
});
```

This gives us **one** default template that works for both modes. No variant, no post-process transform. Clean.

### JSON Schema Concern

You don't need a schema variant or conditional for this. The `commit.headerTemplate` is always a string. The fact that `{{ workspaceReleases | format_workspace_releases }}` renders differently based on mode is a **runtime** behavior, not a schema concern. The JSON Schema just says: *"String template for commit header."* The description can mention: *"In monorepo mode, use `{{ workspaceReleases | format_workspace_releases }}` to include all workspace versions."*

---

## FQ4 — Is `@` Too JS-Centric?

Honest answer: **`@` is language-agnostic.** It is used as a "targeting" or "versioning" symbol far beyond JavaScript:

- **Python**: `pip install package==1.0.0` (uses `==`, but `@` is used for URL-based installs: `pip install package @ https://...`)
- **Go**: `go get module@v1.0.0`
- **Rust**: Cargo doesn't use `@`, but Rust developers are familiar with it from Docker, Git, etc.
- **Docker**: `image@sha256:abc123`
- **Git**: `git show HEAD@{2}`
- **Email**: `user@domain`

The `@` symbol universally means "at" or "targeting a specific thing." `Release-As: core@2.0.0` reads naturally: *"Release `core` at version `2.0.0`."*

**Alternative symbols considered:**
- `=` → `core=2.0.0` — could be confused with assignment/env vars
- `:` → `core:2.0.0` — conflicts with the footer separator (`Release-As: core:2.0.0` → is the value `core:2.0.0` or is `core` a nested key?)
- `/` → `core/2.0.0` — could be confused with path separators
- `#` → `core#2.0.0` — could be confused with issue references

**`@` is the best choice.** It has no parsing ambiguity and its meaning is universally understood across all ecosystems.

---

## FQ5 — `review.groupProposals` Timing

Agreed. Add it during monorepo implementation, early in the process (schema change before the heavy workflow logic). It has no effect on single-repo behavior and is only meaningful in monorepo context.

---

## FQ6 — Source Mode Clarification

Thank you for the correction. I now understand:
- `source-mode` controls **file reading** (e.g., reading `CHANGELOG.md`, version files, config files — from local filesystem vs GitHub API).
- The **Git commit/tag operations** are always determined by the **provider** (GitHub provider uses GitHub API, a future local provider would use local git commands).
- These are independent axes.

So the `path` parameter on `listCommitsInRange` is a **provider-level** feature. The GitHub provider passes it as `?path=` to the API. A future local provider would use `git log -- <path>`. Neither has anything to do with `source-mode`.

---

## RQ1 — Workspace Name Casing and Validation

You make a fair point. Since `Release-As` parsing is on the value side, and `__`/`--` delimiters are visually unambiguous, there's no technical parsing reason to restrict names.

**However**, I still recommend one minimal restriction: **no `@` in workspace names.** Because `Release-As: core@2.0.0` uses `@` as the name/version separator, a workspace named `@scope/pkg` would create `Release-As: @scope/pkg@2.0.0` — the parser would split at the first `@` and get `name=""`, `version="scope/pkg@2.0.0"`. We'd need to split at the **last** `@` to handle this correctly.

**Recommendation:** Either:
- **A)** Restrict: no `@` in workspace names (simplest), or
- **B)** Parse `Release-As` by splitting at the **last** `@` (handles scoped names, slightly more complex)

For maximum flexibility, I'd go with **B** — split at the last `@`. This way npm-scoped names like `@scope/pkg` work naturally: `Release-As: @scope/pkg@2.0.0` → split at last `@` → name=`@scope/pkg`, version=`2.0.0`.

### Name Casing — Keep As-Is

**Absolutely agree — do not transform the name.** Whatever the user writes in their config is what appears in env vars, outputs, tags, and footers. No case conversion.

`name: "my-pkg"` → `ZR__my-pkg__NEXT_VERSION`

This is the principle of least surprise. If we silently converted `my-pkg` to `MY_PKG` or `my_pkg`, users would be confused when trying to reference their workspace by name.

The only transformation is the env var prefix/suffix (`ZR__` and `__NEXT_VERSION`), which is Zephyr's convention, not the user's data.

---

## Final Summary of All Decisions

Every architectural question has been answered. Here is the complete decision ledger:

| # | Topic | Decision |
|---|-------|---------|
| 1 | Monorepo detection | Implicit — presence of `workspace` key |
| 2 | Tag resolution | `tag.matchPatterns` (globs) + auto-derived pattern from `nameTemplate`. Drop `getLatestRelease` and `parseLooseSemVer` |
| 3 | Provider refactor | Split into `findLastReleaseHash(matchPatterns)` + `listCommitsInRange(from, to, path?, max?)` |
| 4 | Commit fetching | Per-workspace path-filtered API calls (`?path=`), parallelized |
| 5 | `releaseFlow` | Global only. Renamed from `mode` ✅ |
| 6 | `auto` naming | Keep as-is |
| 7 | `review` naming | Keep as-is |
| 8 | `auto.triggerStrategy` | Per-workspace override allowed |
| 9 | `review` in workspace | Full `review` block included (labels, assignees, reviewers all included) |
| 10 | `review` overrides when `group-proposals: true` | Silently ignored with a warning log. No Valibot variant |
| 11 | `review.groupProposals` | Added during monorepo implementation (meaningless for single-repo) |
| 12 | `initialVersion` | Per-workspace |
| 13 | `commit.headerTemplate` | Per-workspace (used when `group-proposals: false`). Unified default using `format_workspace_releases` filter |
| 14 | `commit` — per-workspace commits | Single commit when grouped / auto. Per-workspace commit when `group-proposals: false` |
| 15 | Changelog path | Relative to workspace path |
| 16 | Tag default | `{{ name }}-v{{ nextVersion }}` |
| 17 | Working branch default (workspace) | `zephyr-release/{{ name }}/{{ triggerBranchName }}` |
| 18 | `Release-As` syntax | `Release-As: core@2.0.0, cli@3.0.0`. Split at last `@`. Bare `Release-As: 2.0.0` = global |
| 19 | String pattern context | Incremental pure refactor: add explicit `context` param, fallback to global |
| 20 | Env variables | Flatten: `ZR__my-pkg__NEXT_VERSION`. Name kept as-is (no case transform). All workspaces exported in all hooks |
| 21 | Output variables | `zr--my-pkg--next-version` (monorepo), `zr-next-version` (single-repo only) |
| 22 | Hook scope | `preRun`/`postRun`/`preCommit`/`postCommit`/`postProposal` = global. `pre/postCalculateVersion`/`preTag`/`pre/postRelease` = per-workspace |
| 23 | Multi-path per workspace | No. One path = one workspace |
| 24 | Root package (`.`) | Matches all commits (dumb filter) |
| 25 | Dependency graph | Not in v1. Hooks cannot affect execution plan |
| 26 | `isMonorepoMode` boolean | On root run settings, set from `config.workspace !== undefined` |
| 27 | Workspace name validation | No restrictions except split `Release-As` at last `@`. Name kept as-is in env/output |
| 28 | Docs | `config-options.md` links to `workspace-config-options.md` |
| 29 | Pre-monorepo implementation order | 1) `tag.matchPatterns` + provider refactor, 2) Pure context refactor, 3) Monorepo (starting with `review.groupProposals` schema) |

**I have no remaining questions. Ready to write the full, file-level implementation plan whenever you give the go-ahead.**

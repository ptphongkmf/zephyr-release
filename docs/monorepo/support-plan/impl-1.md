# Monorepo Support — Concept-Level Design Document

> **Status:** Draft / Concept  
> **Date:** 2025-05-23  
> **Scope:** This document maps out the *what*, *why*, and *how* of adding monorepo support to Zephyr Release at a conceptual level. No implementation details or code changes yet.

---

## Table of Contents

- [1. The Problem](#1-the-problem)
- [2. Industry Research — How Popular Tools Do It](#2-industry-research--how-popular-tools-do-it)
- [3. Community Preference Summary](#3-community-preference-summary)
- [4. Recommended Approach for Zephyr Release](#4-recommended-approach-for-zephyr-release)
- [5. What Changes in Zephyr Release](#5-what-changes-in-zephyr-release)
- [6. Decisions You Must Make](#6-decisions-you-must-make)
- [7. Open Questions](#7-open-questions)
- [8. Risk Analysis](#8-risk-analysis)

---

## 1. The Problem

### Current State

Zephyr Release is designed as a **single-project release tool**. Every concept in the current architecture assumes **one version, one changelog, one tag, one release, one proposal** per run:

| Concept | Current Assumption |
|---|---|
| **Config** | One `ConfigOutput` object, one `mode`, one set of `versionFiles` |
| **Version** | One `currentVersion` → one `nextVersion` (from a single primary version file) |
| **Commits** | All commits since last release are relevant — no path filtering |
| **Changelog** | One changelog file, one release entry |
| **Tag** | One tag name (e.g. `v1.2.3`) |
| **Release** | One GitHub Release |
| **Proposal (Review mode)** | One working branch, one PR per trigger branch |
| **Commit (output)** | One commit pushed with all version file + changelog changes |

### What Monorepo Needs

A monorepo contains **multiple independently-versioned packages** in the same repository. Each package needs:

- Its **own version** (tracked in its own version file)
- Its **own changelog** (scoped to changes that affect it)
- Its **own tag** (namespaced, e.g. `@my-pkg/v1.2.0` or `my-pkg/v1.2.0`)
- Its **own release** (on GitHub, with package-specific release notes)
- Commits **filtered by path** (only commits touching `packages/my-pkg/**` should trigger a bump for `my-pkg`)

The core tension: **the current pipeline is a single linear flow — monorepo needs it to become a loop (or fan-out) over N packages.**

---

## 2. Industry Research — How Popular Tools Do It

### 2.1 release-please (Google) — "Manifest-driven, path-based filtering"

**Approach:**
- Two config files at the repo root:
  - `release-please-config.json` — defines packages by directory path + per-package settings
  - `.release-please-manifest.json` — tracks current version of each package (the source of truth)
- **Change detection:** Path-based. Looks at which files a commit touches, maps that to the package's configured directory. NOT scope-based.
- **PR strategy:** Configurable — either one combined "Release PR" for all packages, or `separate-pull-requests: true` for one PR per package.
- **Tags:** Namespaced per package component (e.g. `pkg-a-v1.0.0`)

**Strengths:** Fully automated, declarative, language-agnostic via `release-type`.  
**Weaknesses:** Complex manifest management, large config surface, less control over changelog quality.

### 2.2 Changesets (Community/Vercel) — "Intent-driven, explicit changeset files"

**Approach:**
- Developers explicitly create `.changeset/*.md` files describing which packages are affected and the bump type (major/minor/patch).
- CI aggregates all pending changesets into a "Version Packages" PR that bumps versions, updates changelogs, and deletes processed changeset files.
- On merge, CI publishes.

**Strengths:** High-quality changelogs (human-written), explicit control, understands dependency graphs.  
**Weaknesses:** Requires developer discipline (manual step), JavaScript-ecosystem-centric, not commit-message-driven.

### 2.3 semantic-release + multi-semantic-release — "Wrapper pattern"

**Approach:**
- `multi-semantic-release` wraps `semantic-release` and runs it for each package sequentially.
- Uses commit scope or path filtering to determine which packages are affected.
- Serializes Git operations to avoid push conflicts.
- Tags are namespaced (e.g. `@scope/pkg@1.0.0`).

**Strengths:** Leverages existing semantic-release ecosystem.  
**Weaknesses:** Complex, fragile serialization, high coupling to semantic-release internals, race conditions.

### 2.4 Lerna / Nx Release — "Workspace-aware graph-based"

**Approach:**
- Understands the project graph (package dependency tree).
- Can do both independent and fixed/linked versioning.
- Nx Release uses Git-based change detection with project boundaries.

**Strengths:** Deep dependency graph understanding, can cascade bumps.  
**Weaknesses:** Tightly coupled to JS/TS ecosystem, heavyweight.

---

## 3. Community Preference Summary

Based on research into community sentiment (2024–2026):

| Criterion | Community Consensus |
|---|---|
| **Versioning strategy** | **Independent versioning** is strongly preferred for libraries/packages. Linked (fixed) versioning is only for tightly coupled suites (React, Babel). |
| **Change detection** | **Path-based filtering** is the standard. Commit-scope filtering is unreliable (devs forget scopes, scopes are ambiguous). |
| **PR strategy** | Mixed — combined PR is simpler for small monorepos; separate PRs give more control for large ones. Most tools default to combined. |
| **Tag format** | **`<component>/v<version>`** or **`<component>-v<version>`** are the most common. The `@scope/pkg@version` npm-style is JS-specific. |
| **Most liked approach** | **release-please's manifest model** is the most popular fully-automated approach. **Changesets** is preferred when human-written changelogs are valued. Since ZR is commit-driven (like release-please), the **manifest model with path-based filtering** is the natural fit. |

---

## 4. Recommended Approach for Zephyr Release

### Core Philosophy: "Manifest-driven, path-filtered, loop-over-packages"

This approach is chosen because:
1. ZR is already commit-message-driven (Conventional Commits) — aligns with release-please, not Changesets
2. ZR already has the concept of `versionFiles` with selectors — this can naturally extend to per-package config
3. Path-based filtering is more reliable than scope-based filtering
4. It preserves ZR's existing config flexibility (multi-format, multi-casing, runtime overrides)

### High-Level Concept

```
┌──────────────────────────────────────────────────────────────┐
│                    SINGLE REPO CONFIG                        │
│                                                              │
│  zephyr-release-config.json (root)                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  "packages": {                                         │  │
│  │    "packages/core": { ... per-pkg config overrides },  │  │
│  │    "packages/cli":  { ... per-pkg config overrides },  │  │
│  │    ".":             { ... root package (optional) }    │  │
│  │  }                                                     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  When "packages" key is present → monorepo mode              │
│  When "packages" key is absent  → single-repo mode (current) │
└──────────────────────────────────────────────────────────────┘
```

### Execution Flow (Conceptual)

```
1. Bootstrap (same as today)
   ├── Parse trigger context
   ├── Setup working branch
   └── Find proposals

2. Resolve all commits since last release (same as today)

3. FOR EACH package in config.packages:
   │
   ├── 3a. Filter commits that touch this package's path
   │       (using the resolved commit list from step 2)
   │
   ├── 3b. If no relevant commits → skip this package
   │
   ├── 3c. Get current version (from this package's version file)
   │
   ├── 3d. Calculate next version (using filtered commits)
   │
   ├── 3e. Generate changelog (scoped to this package)
   │
   ├── 3f. Prepare version file changes (for this package)
   │
   └── 3g. Collect all changes into a shared commit manifest

4. Commit all package changes in ONE commit (or per-package)

5. FOR EACH package that was bumped:
   ├── Create namespaced tag
   ├── Create release (with package-specific notes)
   └── Attach assets (if configured per-package)

6. Create/Update proposal (combined or per-package)
```

---

## 5. What Changes in Zephyr Release

### 5.1 Config Schema

**New top-level field: `packages`**

```
packages:
  <path>:
    # Per-package overrides (all optional, inherit from root)
    name: "my-package"
    version-files: [...]
    changelog: { path: "packages/core/CHANGELOG.md", ... }
    tag: { name-template: "core/v{{ nextVersion }}", ... }
    release: { title-template: "core v{{ nextVersion }}", ... }
    commit-types: [...]  # optional override
    component: "core"    # short identifier for tags/releases
```

**Key design:** Per-package config should be a **subset** of the root config. Package-level values override root-level defaults. This is the same model release-please uses and it works well.

### 5.2 Commit Filtering

**New logic needed in `commit.ts`:**

Currently `resolveCommitsFromTriggerToLastRelease()` returns ALL commits. For monorepo, we need to **post-filter** the resolved commits per package path.

Concept:
```
function filterCommitsForPackage(
  allCommits: ResolvedCommit[],
  packagePath: string,
  provider: PlatformProvider,
): ResolvedCommit[]
```

This requires knowing **which files each commit touched**. Two approaches:
- **API approach (remote):** Use the GitHub API to get the file list for each commit (`GET /repos/{owner}/{repo}/commits/{sha}`)
- **Local approach:** Use `git diff-tree --no-commit-id --name-only -r <sha>` for each commit

The file paths are then matched against the package's directory using glob/prefix matching.

> **Important:** This is the biggest behavioral change. Today ZR doesn't need to know which files a commit touched — it only cares about the commit message. Monorepo support requires file-level awareness.

### 5.3 Version Tracking

**Current:** One primary version file → one `currentVersion`.  
**Monorepo:** Each package has its own version file(s) → each package has its own `currentVersion` and `nextVersion`.

The existing `versionFiles` + `selector` system already supports arbitrary file paths and selectors, so this is mostly a matter of scoping — running the same logic N times with different configs.

### 5.4 Tags

**Current:** One tag (e.g. `v1.2.3`) via `tag.nameTemplate`.  
**Monorepo:** N tags, each namespaced. The `nameTemplate` already supports string patterns, so something like:

```
tag:
  name-template: "{{ component }}/v{{ nextVersion }}"
```

New string pattern `{{ component }}` would be populated per-package.

### 5.5 Changelog

**Current:** One `CHANGELOG.md` at root.  
**Monorepo:** Each package gets its own changelog at its own path (e.g. `packages/core/CHANGELOG.md`).

The existing changelog generation logic doesn't need fundamental changes — it just needs to run with the filtered commit list for each package.

### 5.6 Proposals (Review Mode)

This is the most complex area. Options:

| Strategy | Description | Complexity |
|---|---|---|
| **Combined PR** | One PR containing all package bumps. One working branch. | Lower — closest to current behavior |
| **Separate PRs** | One PR per package. Separate working branches. | Higher — needs branch management per package |

**Recommendation:** Start with **combined PR** (single working branch, all package changes in one PR). Add separate PRs as a future option.

The PR body would list all packages being released:
```markdown
## Release Proposal

### packages/core — v1.3.0
<changelog for core>

### packages/cli — v2.0.0
<changelog for cli>
```

### 5.7 Git Commit (Output)

**Current:** One commit with all changes.  
**Monorepo:** Still one commit, but containing changes from all affected packages (version files + changelogs). This is the simpler model and avoids Git serialization issues.

### 5.8 Exported Variables

Currently exports like `ZR_NEXT_VERSION`, `ZR_TAG_NAME` etc. are singular.  
For monorepo, these need to become structured (JSON) or per-package:

```
ZR_RELEASED_PACKAGES='[{"component":"core","version":"1.3.0","tagName":"core/v1.3.0"},...]'
ZR_NEXT_VERSION_core="1.3.0"
ZR_NEXT_VERSION_cli="2.0.0"
```

---

## 6. Decisions You Must Make

### Decision 1: How to detect monorepo mode?

| Option | Description |
|---|---|
| **A) Implicit** (recommended) | If `packages` key exists in config → monorepo mode. If absent → single-repo mode (backward compatible). |
| **B) Explicit** | New field `type: "monorepo" \| "single"`. |

> **Recommendation:** Option A. It's how release-please does it. No extra field, zero config change for existing users.

---

### Decision 2: How to associate commits with packages?

| Option | Description | Reliability |
|---|---|---|
| **A) Path-based filtering** (recommended) | Check which files each commit touches, match against package directory | ✅ High — objective, reliable |
| **B) Scope-based filtering** | Use the `(scope)` in `feat(scope): ...` to route commits | ⚠️ Low — devs forget scopes, scopes are ambiguous |
| **C) Both (path + optional scope override)** | Default to path-based, allow scope-based opt-in for edge cases | ✅ Flexible but more complex |

> **Recommendation:** Option A (path-based), possibly with C as a future enhancement. This is the community consensus.

---

### Decision 3: Proposal strategy (Review Mode)?

| Option | Description |
|---|---|
| **A) Combined PR** (recommended for v1) | Single PR with all package changes. Simpler, matches current architecture. |
| **B) Separate PRs per package** | Each package gets its own PR + working branch. More flexible but significantly more complex. |

> **Recommendation:** Start with A. Add B as an opt-in later.

---

### Decision 4: Commit strategy?

| Option | Description |
|---|---|
| **A) Single commit** (recommended) | All package version bumps + changelogs in one commit. |
| **B) Per-package commits** | One commit per package. Allows per-package tags to point to distinct commits. |

> **Recommendation:** A. Simpler, avoids Git push serialization. Tags can all point to the same commit — this is what release-please does.

---

### Decision 5: Tag naming convention?

| Option | Example |
|---|---|
| **A) `<component>/v<version>`** | `core/v1.2.3` |
| **B) `<component>-v<version>`** | `core-v1.2.3` |
| **C) Fully configurable** (recommended) | User sets `tag.name-template` per package, defaults to `{{ component }}-v{{ nextVersion }}` |

> **Recommendation:** C with default B. The `-v` separator is more universally compatible (some Git hosts don't handle `/` in tags well). But make it configurable via the existing `nameTemplate`.

---

### Decision 6: Per-package config inheritance?

| Option | Description |
|---|---|
| **A) Deep merge** (recommended) | Package config deep-merges over root config. Packages only specify what they want to override. |
| **B) Full replace** | Package config fully replaces root config sections. Must specify everything. |

> **Recommendation:** A. Deep merge is standard (release-please, multi-semantic-release, etc.) and dramatically reduces config boilerplate.

---

### Decision 7: How to get file lists for commits (for path-based filtering)?

| Option | Description | Trade-offs |
|---|---|---|
| **A) Batch API call** | For each commit, call GitHub API to get changed files | Slow for large histories, rate-limit risk |
| **B) Local git diff-tree** | Run `git diff-tree` locally for each commit | Fast, but requires local checkout (`source-mode: local`) |
| **C) Compare endpoint** | Use GitHub's compare API for the full range, then map | Fewer API calls, but limited to 300 files per comparison |
| **D) Commit data enrichment** | Modify the provider to include changed files when listing commits | Clean but requires changing the provider interface |

> **Recommendation:** D as the ideal long-term solution (enrich `ProviderCommit` with file paths). B as the fastest to implement for `source-mode: local`. A as fallback for `source-mode: remote`.

---

## 7. Open Questions

### Q1: Should packages be able to have different `mode` values?
> e.g. `packages/core` uses `review` mode while `packages/internal-tool` uses `auto` mode.  
> This would add significant complexity. **Probably not for v1.**

### Q2: How to handle commits that touch multiple packages?
> Path-based filtering naturally handles this — the commit appears in the filtered list for ALL packages whose paths it touches. Each package bumps independently. This is the standard behavior.

### Q3: Should there be dependency-graph awareness?
> e.g. If `packages/core` bumps, should `packages/cli` (which depends on core) also bump automatically?  
> This is a Changesets/Lerna feature. **Not needed for v1** — it adds massive complexity and is ecosystem-specific (needs to understand package.json, Cargo.toml, etc.).

### Q4: What about the "root" package?
> Should the user be able to release the root itself (path: `.`)? release-please supports this.  
> **Probably yes** — it's useful for projects that have both a root app and sub-packages.

### Q5: How to handle `release-as` (manual version override) in monorepo?
> Currently, `release-as` is parsed from the trigger commit footer. In monorepo, should it be per-package?  
> Possible format: `release-as(core): 2.0.0` or separate footer per package.

### Q6: How to handle the `resolveUntilCommitHash` config in monorepo?
> This is currently a global setting. Should it be per-package? Probably global is fine since it controls the commit window, not the filtering.

### Q7: What happens with `auto` mode + monorepo + the loop detection commit sign?
> Currently, auto mode pushes a commit with `zephyr-release: <version>` to prevent infinite loops. In monorepo, the commit would contain changes for multiple packages. The sign needs to still prevent re-triggering. This should work as-is since the sign is on the commit, not per-package.

---

## 8. Risk Analysis

| Risk | Severity | Mitigation |
|---|---|---|
| **Breaking existing single-repo users** | 🔴 High | Monorepo mode is opt-in (presence of `packages` key). Zero changes for users who don't use it. |
| **API rate limits** (commit file-list fetching) | 🟡 Medium | Cache file lists, use local mode when possible, batch requests |
| **Config complexity explosion** | 🟡 Medium | Good defaults + deep merge inheritance. Most packages should need minimal config. |
| **Proposal (PR) body becoming huge** | 🟡 Medium | Use collapsible sections (`<details>`) per package in the PR body |
| **Tag collision / naming conflicts** | 🟢 Low | Namespaced tags with configurable template |
| **Git push conflicts (auto mode)** | 🟡 Medium | Single commit for all packages (already mitigated by serial execution) |
| **Scope creep** | 🔴 High | Clearly define v1 boundary: no dependency graphs, no per-package modes, no separate PRs |

---

## Summary: The Minimum Viable Monorepo (v1 Scope)

| Feature | In v1? | Notes |
|---|---|---|
| `packages` config with path-based package definitions | ✅ | Core feature |
| Path-based commit filtering | ✅ | Core feature |
| Per-package version files | ✅ | Already supported conceptually via `versionFiles` |
| Per-package changelog | ✅ | Same logic, different path + filtered commits |
| Per-package namespaced tags | ✅ | Via `{{ component }}` in tag template |
| Per-package GitHub Releases | ✅ | One release per bumped package |
| Combined PR (review mode) | ✅ | One PR with all package changes |
| Per-package config inheritance (deep merge) | ✅ | Reduces boilerplate |
| Structured exported variables | ✅ | JSON output for downstream steps |
| Separate PRs per package | ❌ | Future enhancement |
| Dependency graph awareness | ❌ | Future enhancement, ecosystem-specific |
| Per-package `mode` (review/auto) | ❌ | Future enhancement |
| Scope-based commit routing | ❌ | Unreliable, not recommended |
| Changeset files (developer intent) | ❌ | Different philosophy, out of scope |

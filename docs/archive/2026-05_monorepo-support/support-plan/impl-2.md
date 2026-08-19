# Monorepo Support — Implementation Plan (Draft 2)

> **Status:** Draft / Implementation Plan  
> **Date:** 2026-05-25  
> **Scope:** Detailed implementation design for Zephyr Release monorepo support, incorporating decisions on workspace configuration, PR/Release grouping, tagging, and manual commit/release-as footers. This document also leaves room for future intent-driven (changeset-like) architecture without building it into v1.

---

## 1. Architectural Strategy (Future-proofing for Intent-Driven)

To ensure we can support an intent-driven model (like Changesets) in the future without throwing away the monorepo work, we will introduce an **abstraction layer** between commit resolution and release execution. 

Currently, the pipeline operates directly on `ResolvedCommit[]`. 
In the new architecture, the `ResolvedCommit[]` will be mapped into a list of **`VersionBumpIntent`** objects per workspace. 
For v1, these intents are generated strictly from the git commit history (path-filtered). In the future, a different parser could generate these exact same `VersionBumpIntent` objects from `.changeset` markdown files.

```typescript
interface VersionBumpIntent {
  workspaceName: string;         // The required 'name' of the workspace
  workspacePath: string;         // e.g., 'packages/core'
  bumpType: "major" | "minor" | "patch" | "none";
  currentVersion: SemVer;
  nextVersion: SemVer;
  changelogEntries: ResolvedCommit[]; // For v1, we still pass commits to the changelog generator
}
```

This abstraction ensures that the execution phase (writing files, tagging, creating PRs) is decoupled from *how* the bump was decided.

---

## 2. Configuration Design: The `workspace` Property

We will use the property name `workspace` to define monorepo members.

### Inline Overrides vs. Distributed Configs

**The Debate:**
1. **Inline Overrides (`"path": { ...overrides }`)**: Everything is in one `zephyr-release-config.json` at the root.
2. **Distributed Configs (`"path": "path/to/config.json"`)**: Root config points to child configs, mimicking `package.json` workspaces.

**Practical Analysis:**
*   **Distributed (Config-per-workspace) Pros**: Better for massive monorepos (e.g., 50+ packages) where a central config becomes unreadable. Team ownership is clearer (Team A owns `packages/core/zephyr.json`).
*   **Distributed Cons**: Schema validation is harder (you have to recursively load and validate). Tooling is slower (reading 50 files instead of 1). 
*   **Inline Pros**: Single source of truth. Easy to read top-down. Fast validation.
*   **Inline Cons**: Can get long if every package has heavy overrides.

**The Decision for v1:** 
Support **Inline Overrides** as the standard, but use an object structure that allows us to support distributed configs later if requested.

```json
{
  "workspace": {
    "packages/core": {
      "name": "core", 
      "version-files": ["deno.json"],
      "tag": { "name-template": "{{ name }}/v{{ nextVersion }}" }
    },
    "packages/cli": {
      "name": "cli",
      "version-files": ["package.json"]
    }
  },
  "review": {
    "group-pull-requests": true
  }
}
```
*Note: In the future, we could easily allow `"packages/core": "packages/core/zephyr-pkg.json"` as a string if we want to add distributed support, making the object structure flexible.*

---

## 3. PR and Release Grouping (Batching)

We must support a boolean choice to either batch everything into a single PR/Release or do it per-package.

**New Config Option (Root level):**
`review.group-pull-requests` (boolean, default: `true`)
`release.group-releases` (boolean, default: `true` or tied to PR grouping?)

*   **Grouped (`true`)**: 
    *   **Review Mode**: Creates **ONE** branch and **ONE** Pull Request containing all version bumps and a combined changelog. 
    *   **Auto Mode/Publish**: Creates **ONE** GitHub Release containing the combined changelog. (Note: Git tags are always per-package, regardless of this setting).
*   **Separate (`false`)**: 
    *   Creates separate branches, separate PRs, and separate GitHub Releases per workspace.

**Combined PR Body Format Example:**
```markdown
## Zephyr Release Proposal

### 📦 core (v1.2.0)
* feat: added new engine
* fix: resolved memory leak

### 📦 cli (v2.0.1)
* fix: typo in help menu
```

---

## 4. Tag Naming Convention and the `name` Property

In a monorepo, tags **must** be namespaced to prevent collisions. 

*   **The `name` property**: In single-repo mode, `name` is optional. In monorepo mode, **`name` becomes REQUIRED** for every defined workspace. 
*   **Default Tag Template**: For workspaces, the default tag template changes from `v{{ nextVersion }}` to `{{ name }}/v{{ nextVersion }}`.
*   **UX Error Handling**: If a user intentionally overrides the `tag.name-template` and forgets to include the `{{ name }}` variable (resulting in identical tags for different packages like `v1.2.0`), we will let it fail at the Git level. It is a user error.

---

## 5. Associating Commits: Path Filtering + Manual Footers

By default, we use **Path-Based Filtering**. A commit belongs to a workspace if it modifies any file within the workspace's path.

However, sometimes a developer needs to manually force a commit to be associated with a workspace (e.g., a root-level script change that affects `packages/core`).

**New Footer Syntax for Manual Inclusion:**
We will introduce a `Zephyr-Include` (or `zephyr-include`) footer.

```text
feat: update root build script to support new core features

This changes the root rollup config.

zephyr-include: packages/core
```
*Rule: If `zephyr-include: <path>` is present, the commit is forcefully added to that workspace's intent calculation, even if no files in that path were touched.*

---

## 6. Manual Version Overrides (`release-as`) in Monorepo

The standard `release-as: 2.0.0` footer is ambiguous in a monorepo. Which package does it apply to?

**New Monorepo-Aware Syntax:**
We will support targeting specific workspaces by their `name` property using the footer `Release-As-<name>`.

```text
chore: massive refactor of the cli package

Release-As-cli: 3.0.0
Release-As-core: 1.5.0
```
*Rule: The parser looks for footers matching `/^release-as-(.+)$/i`. It matches the extracted string against the `name` of the defined workspaces. This is explicit and avoids path-string typos.*

---

## 7. Execution Flow (Updated for v2)

1. **Bootstrap & Context**: Validate config. If `workspace` exists, require `name` for each entry.
2. **Resolve Commits**: Fetch all commits since the last release of *each* package. (This requires looking up the latest tag per workspace, e.g., finding the latest `core/v*` tag).
3. **Intent Generation (The Abstraction)**:
   * Iterate over workspaces.
   * For each workspace, filter commits by path AND check for `zephyr-include: <path>` footers.
   * Parse `Release-As-<name>` footers for explicit version overrides.
   * Calculate `currentVersion` and `nextVersion`.
   * Emit a `VersionBumpIntent`.
4. **Prepare Changes**:
   * For each `VersionBumpIntent` that has a bump, generate its scoped changelog and update its local version files.
   * Aggregate all changes into a single Map of file changes.
5. **Review Phase (Grouped = true)**:
   * Push all changes to one branch.
   * Create one PR with a combined markdown body.
6. **Publish Phase**:
   * For each bumped intent, create the tag (`core/v1.2.0`).
   * Create GitHub Release(s) based on grouping preference.

---

## 8. Open Questions for You

1. **GitHub Releases grouping:** If `group-pull-requests: true`, should we also combine the final GitHub Release into one massive release note (e.g., Release `2026-05-25` containing notes for both `core` and `cli`), or should we always create individual GitHub Releases per package (linked to their specific tags)? *My recommendation: Keep PRs grouped, but GitHub Releases should ideally map 1:1 with the tags, so separate GitHub Releases is usually better.*
2. **Cross-Workspace Dependencies:** If `packages/cli` depends on `packages/core` in its `package.json`, and `core` gets bumped, do you want Zephyr Release to automatically bump the version string of `core` inside `packages/cli/package.json`? *(Warning: This adds high complexity and requires parsing package manager specifics. Best to leave out of v1, but good to know your stance).*
3. **Root Package (`.`):** If the user defines `.` as a workspace, it will match *every* commit by path. Do we automatically exclude child workspace paths from the root path filter, or leave it dumb (root matches everything)?

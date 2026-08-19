# Phase 3: Docs & Public-Facing Changes List

> Track all schema description updates, new docs sections, and user-facing behavioral changes here.
> After implementation is complete, use this list to update all `.md` docs and schema descriptions.

---

## Schema Description Updates

### Path Resolution Notes

#### Paths that ARE auto-prepended (workspace-relative)

- [x] `versionFiles > path` in `base-config.ts` — add: *"In monorepo mode, this path is relative to the workspace directory (auto-prepended with the workspace path key)."*
- [x] `changelog > path` in `changelog-config.ts` — same note

#### Paths that are NOT auto-prepended (always repo-root-relative)

Add to each: *"This path is always relative to the repository root, even in monorepo mode."*

- [x] `runtimeConfigOverride > path` — global, not per-workspace
- [x] `changelog > releaseBodyOverridePath`
- [x] `changelog > releaseBodyOverrideAltPath`
- [x] `review > titleTemplatePath`
- [x] `review > headerTemplatePath`
- [x] `review > bodyTemplatePath`
- [x] `review > footerTemplatePath`
- [x] `tag > messageTemplatePath`
- [x] `changelog > releaseHeaderTemplatePath`
- [x] `changelog > releaseSectionHeadingTemplatePath`
- [x] `changelog > releaseSectionEntryTemplatePath`
- [x] `changelog > releaseBreakingSectionEntryTemplatePath`
- [x] `changelog > releaseFooterTemplatePath`
- [x] `changelog > releaseHeaderTemplateAltPath`
- [x] `changelog > releaseSectionHeadingTemplateAltPath`
- [x] `changelog > releaseSectionEntryTemplateAltPath`
- [x] `changelog > releaseFooterTemplateAltPath`
- [x] `changelog > fileHeaderTemplatePath`

---

## New Schema Fields

- [x] `workspace` on root `ConfigSchema` — record of workspace members (ordered last, after lifecycle)
- [x] `review > groupProposals` — boolean, default true
- [x] `commandHooks` on `WorkspaceMemberConfigSchema` — per-workspace hook overrides

---

## New/Modified Constants

- [x] `DEFAULT_WORKSPACE_TAG_NAME_TEMPLATE` in `string-templates.ts`
- [x] `DEFAULT_WORKSPACE_WORKING_BRANCH_NAME_TEMPLATE` in `string-templates.ts`
- [x] `CONFIG_OVERRIDE_MARKERS` in `config-override-markers.ts` (new file, keys: `.start` / `.end`)

---

## New Utility Functions

- [x] `sanitizeNameForEnv(name)` in `case.ts`
- [x] `sanitizeNameForOutput(name)` in `case.ts`
- [x] `toWorkspaceEnvKey(workspaceName, varName)` in `case.ts`
- [x] `toWorkspaceOutputKey(workspaceName, varName)` in `case.ts`
- [x] `resolveWorkspaces(rootConfig)` in `workspace-resolver.ts` (new file, deepMerge + Valibot)
- [x] `extractOverrideFromStdout(stdout)` in `runtime-override.ts`
- [x] `executeHookWithOverride(...)` in `hook-runner.ts` (in `src/workflows/`, uses orchestrator-level `logger`)
- [x] `parseReleaseAsFooter(value)` in `commit.ts` — parses workspace-specific Release-As footer
- [x] `resolveWorkspaceFilePath(filePath, workspaceRelativePath)` in `commit.ts` — path resolution for monorepo

### New/Modified Types

- [x] `ResolvedWorkspace` in `workspace-context.ts` — no redundant `name` field, uses `config.name`
- [x] `OperationRunSettings` in `operation-context.ts` — added `isMonorepoMode`, `workspaces`
- [x] `ParsedReleaseAs` in `commit.ts` — `{ global?: string; workspaces: Map<string, string> }`
- [x] `AffectedWorkspace` in `workspace-detection.ts` — extends `ResolvedWorkspace` with release hash/tag

### Modified Function Signatures (3D)

- [x] `prepareChangesToCommit()` — added `workspaceRelativePath: string = "."`
- [x] `prepareChangelogFileToCommit()` — added `workspaceRelativePath: string = "."`
- [x] `getVersionSemVerFromVersionFile()` — added `workspaceRelativePath: string = "."`
- [x] `prepareVersionFilesToCommit()` — added `workspaceRelativePath: string = "."`

### Modified Function Signatures (3F)

- [x] `resolveCommitsFromTriggerToLastRelease()` — added `stopHashOverride?: string`, `pathFilter?: string`
- [x] `getCurrentVersion()` — added `workspaceRelativePath: string = "."`

### Refactored Workflow Files (3F)

- [x] `run.ts` — added ungrouped proposals guard for monorepo mode
- [x] `auto.ts` — workspace-aware 3-phase loop (per-ws version → global commit → per-ws tags/releases)
- [x] `review.prepare.ts` — workspace-aware loop + single commit + single proposal
- [x] `review.publish.ts` — per-workspace version extraction + per-ws tags/releases
### Exported Variables (3G)

- [x] `WorkspaceVariableData` + `WorkspaceSummaryVariables` types in `operation-variables.ts`
- [x] `exportWorkspaceSummaryVariables()` in `export-variables.ts` — per-workspace namespaced env/output variables
  - `ZR__<name>__NEXT_VERSION`, `ZR__<name>__TAG_NAME`, `ZR__<name>__PATH`
  - `ZR_IS_MONOREPO`, `ZR_WORKSPACES` (JSON), `ZR_AFFECTED_WORKSPACES` (JSON)
- [x] Integration in `auto.ts` + `review.prepare.ts` (after Phase 1 loop)

---


## Docs Updates Required

### [NEW] docs/workspace-config-options.md
- [x] Full reference for workspace member config
- [x] Path resolution rules section (which paths are auto-prepended, which are not)
- [x] Per-workspace hook inheritance explanation

### [MODIFY] docs/config-options.md
- [x] Add `workspace` property section with link to workspace-config-options.md
- [x] Add `review > group-proposals` description

### [MODIFY] docs/export-variables.md
- [x] Document `ZR_NAME` — set during per-workspace hooks
- [x] Document `ZR_IS_MONOREPO` — boolean
- [x] Document `ZR_WORKSPACES` — JSON summary of all workspaces
- [x] Document workspace-namespaced variables (`ZR__<name>__*` / `zr--<name>--*`)
- [x] Sanitization rules table (env: `[^a-zA-Z0-9_]` → `_`, output: `[^a-zA-Z0-9_-]` → `_`)

### [MODIFY] docs/command-hooks.md
- [x] Document global vs per-workspace hook table
- [x] Document per-workspace hook inheritance via deepMerge (field-level)
- [x] Document stdout-based config override with marker delimiters
- [x] Note: `preCommit`, `postCommit`, `postProposal` hooks ignored per-workspace when `groupProposals: true`
- [x] Note: `preRun`, `postRun` are always global (root config only)

### [MODIFY] docs/input-options.md
- [x] Note about source-mode interaction with workspace paths (template paths are always repo-root-relative)

### [MODIFY] README.md
- [x] Update "Dynamic Configuration Overrides" section to mention stdout capture
- [x] Add monorepo section / link to workspace docs
- [x] Update "Force a Specific Version" to mention workspace-scoped Release-As syntax

### Schema Description Updates
- [x] `versionFiles > path` — added monorepo note (auto-prepended with workspace path)
- [x] `changelog > path` — added monorepo note (auto-prepended with workspace path)
- [x] `runtimeConfigOverride > path` — added monorepo note (always repo-root-relative) + metadata description
- [x] All template paths (changelog, review, commit, tag, release) — added monorepo note (always repo-root-relative)

### Stdout Buffer Memory Safety
- [x] `command.ts` — added `MAX_STDOUT_BUFFER_BYTES` (10 MB) guard to prevent unbounded memory growth

## Behavioral Changes (Breaking)

- [x] Runtime config override: extracted from 15 inline blocks to `executeHookWithOverride` utility. Behavior unchanged in single-repo. In monorepo, file-based override only at global level, stdout at all levels.
- [x] `runCommands` now returns `RunCommandsResult` with `capturedStdout`. Stdout piped + streamed to parent process in real-time. Buffered for marker extraction.
- [x] Workspace tag defaults: if `workspace` key is present and member doesn't set `tag.nameTemplate`, defaults to `{{ name }}-v{{ nextVersion }}` instead of `v{{ nextVersion }}`.
- [x] Env var names for workspaces use minimal sanitization (casing preserved, only invalid chars replaced).

---

# Phase 4: Remove File-Based Runtime Config Override

> Track all docs/schema changes for the removal of `runtime-config-override` (file-based override).
> See full plan: [4_remove_file_override.md](./4_remove_file_override.md)

## Schema Description Updates

- [x] `base-config.ts` — remove `runtimeConfigOverride` property + import
- [x] `runtime-config-override.ts` — DELETE file entirely
- [x] `command-hook.ts` — remove `runtimeConfigOverride` reference in `preCalculateVersion` description
- [x] `review-config.ts` — update `workingBranchNameTemplate` immutability note (change "runtimeConfigOverride" → "stdout config override")
- [x] `workspace-member-config.ts` — remove `runtimeConfigOverride` from global-only fields comment

## Source Code Changes

- [x] `runtime-override.ts` — delete `resolveRuntimeConfigOverride()` function + `ResolvedRuntimeConfigResult` interface
- [x] `hook-runner.ts` — remove `resolveRuntimeConfigOverride` import, remove `isPerWorkspaceHook` param, remove file-based override block
- [x] `auto.ts` — no changes needed (callers never passed `isPerWorkspaceHook`)
- [x] `review.prepare.ts` — same
- [x] `review.publish.ts` — same

## Docs Updates Required

### [MODIFY] docs/config-options.md
- [x] Remove TOC entries: `runtime-config-override`, `runtime-config-override > path`, `runtime-config-override > format`
- [x] Remove the full `runtime-config-override` property section (~lines 1784-1817)
- [x] Update `working-branch-name-template` immutability note — change "runtime-config-override" → "stdout config override"
- [x] Update `pre-calculate-version` hook description — remove `runtime-config-override` reference

### [MODIFY] docs/command-hooks.md
- [x] Update all `*(If overridden runtime config is returned, it applies moving forward).*` notes to clarify stdout-based mechanism

### [MODIFY] docs/export-variables.md
- [x] Update `ZR_CONFIG` description — change `runtime-config-override` link to stdout config override mention
- [x] Update `ZR_INTERNAL_CONFIG` description — same

### [MODIFY] README.md
- [x] Rewrite "Dynamic Configuration Overrides" section: replace "Runtime File Override" with "Runtime Stdout Override" (marker delimiters)

### [MODIFY] docs/workspace-config-options.md
- [x] Check for and remove any references to file-based override

## JSON Schema Regeneration
- [ ] Run `deno run -A scripts/gen-json-schema.ts` — `runtime-config-override` must disappear from generated schemas (deferred per user)

## Behavioral Changes (Breaking)

- [x] `runtime-config-override` config property removed — users must migrate to stdout-based override via marker delimiters
- [x] `isPerWorkspaceHook` parameter removed from `executeHookWithOverride` — all hooks now use the same stdout-only path

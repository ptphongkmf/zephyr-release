# Phase 3: Docs & Public-Facing Changes List

> Track all schema description updates, new docs sections, and user-facing behavioral changes here.
> After implementation is complete, use this list to update all `.md` docs and schema descriptions.

---

## Schema Description Updates

### Path Resolution Notes

#### Paths that ARE auto-prepended (workspace-relative)

- [ ] `versionFiles > path` in `base-config.ts` — add: *"In monorepo mode, this path is relative to the workspace directory (auto-prepended with the workspace path key)."*
- [ ] `changelog > path` in `changelog-config.ts` — same note

#### Paths that are NOT auto-prepended (always repo-root-relative)

Add to each: *"This path is always relative to the repository root, even in monorepo mode."*

- [ ] `runtimeConfigOverride > path` — global, not per-workspace
- [ ] `changelog > releaseBodyOverridePath`
- [ ] `changelog > releaseBodyOverrideAltPath`
- [ ] `review > titleTemplatePath`
- [ ] `review > headerTemplatePath`
- [ ] `review > bodyTemplatePath`
- [ ] `review > footerTemplatePath`
- [ ] `tag > messageTemplatePath`
- [ ] `changelog > releaseHeaderTemplatePath`
- [ ] `changelog > releaseSectionHeadingTemplatePath`
- [ ] `changelog > releaseSectionEntryTemplatePath`
- [ ] `changelog > releaseBreakingSectionEntryTemplatePath`
- [ ] `changelog > releaseFooterTemplatePath`
- [ ] `changelog > releaseHeaderTemplateAltPath`
- [ ] `changelog > releaseSectionHeadingTemplateAltPath`
- [ ] `changelog > releaseSectionEntryTemplateAltPath`
- [ ] `changelog > releaseFooterTemplateAltPath`
- [ ] `changelog > fileHeaderTemplatePath`

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

---

## Docs Updates Required

### [NEW] docs/workspace-config-options.md
- [ ] Full reference for workspace member config
- [ ] Path resolution rules section (which paths are auto-prepended, which are not)
- [ ] Per-workspace hook inheritance explanation

### [MODIFY] docs/config-options.md
- [ ] Add `workspace` property section with link to workspace-config-options.md
- [ ] Add `review > group-proposals` description

### [MODIFY] docs/export-variables.md
- [ ] Document `ZR_NAME` — set during per-workspace hooks
- [ ] Document `ZR_IS_MONOREPO` — boolean
- [ ] Document `ZR_WORKSPACES` — JSON summary of all workspaces
- [ ] Document workspace-namespaced variables (`ZR__<name>__*` / `zr--<name>--*`)
- [ ] Sanitization rules table (env: `[^a-zA-Z0-9_]` → `_`, output: `[^a-zA-Z0-9_-]` → `_`)

### [MODIFY] docs/command-hooks.md
- [ ] Document global vs per-workspace hook table
- [ ] Document per-workspace hook inheritance via deepMerge (field-level)
- [ ] Document stdout-based config override with `ZR_CONFIG_OVERRIDE_START` / `ZR_CONFIG_OVERRIDE_END` markers
- [ ] Note: `preCommit`, `postCommit`, `postProposal` hooks ignored per-workspace when `groupProposals: true`
- [ ] Note: `preRun`, `postRun` are always global (root config only)

### [MODIFY] docs/input-options.md
- [ ] Note about source-mode interaction with workspace paths (template paths are always repo-root-relative)

### [MODIFY] README.md
- [ ] Update "Dynamic Configuration Overrides" section to mention stdout capture
- [ ] Add monorepo section / link to workspace docs
- [ ] Update "Force a Specific Version" to mention workspace-scoped Release-As syntax

---

## Behavioral Changes (Breaking)

- [x] Runtime config override: extracted from 15 inline blocks to `executeHookWithOverride` utility. Behavior unchanged in single-repo. In monorepo, file-based override only at global level, stdout at all levels.
- [x] `runCommands` now returns `RunCommandsResult` with `capturedStdout`. Stdout piped + streamed to parent process in real-time. Buffered for marker extraction.
- [ ] Workspace tag defaults: if `workspace` key is present and member doesn't set `tag.nameTemplate`, defaults to `{{ name }}-v{{ nextVersion }}` instead of `v{{ nextVersion }}`.
- [ ] Env var names for workspaces use minimal sanitization (casing preserved, only invalid chars replaced).

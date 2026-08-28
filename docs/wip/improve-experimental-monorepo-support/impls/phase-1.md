# Phase 1: Grouped Proposals and Schema Simplification

In this phase, we established that PRs (proposals) will always be grouped in monorepo mode. By enforcing this behavior, we were able to greatly simplify the configuration schemas, especially at the per-workspace level.

## Completed Work

### 1. Logic Simplification
- **Removed `groupProposals` option**: The `review.groupProposals` configuration option was completely removed from the source code and configuration schemas.
- **Removed Validation Check**: Removed the runtime check in `src/run.ts` that previously threw an error if `groupProposals` was false. PRs are now unconditionally grouped.

### 2. Schema Simplification (Workspace Level)
Since all PRs are grouped, several configuration fields that only make sense globally were removed from the workspace-level patch schemas (`WorkspaceMemberConfigSchema`):
- **Removed Global PR Fields**: From `ReviewConfigPatchSchema`, we removed fields that dictate the PR's global state (`draft`, `workingBranchNameTemplate`, `titleTemplate`, `headerTemplate`, `footerTemplate`, `labels`, `assignees`, `reviewers`). 
- **Kept PR Body Templates**: We kept `bodyTemplate` and `bodyTemplatePath` in `ReviewConfigPatchSchema` to allow each workspace to provide its own body template for its section inside the grouped PR.
- **Removed Global Command Hooks**: From `CommandHooksPatchSchema`, we removed `preCommit`, `postCommit`, and `postProposal`. These hooks run around the grouped commit/PR and are strictly managed at the root config.

### 3. Documentation Updates
All documentation files were updated to reflect the current, simplified state of Zephyr Release.
- Removed all mentions of `group-proposals` in `docs/config-options.md`.
- Updated `docs/workspace-config-options.md` to reflect that the `review` block only accepts body templates, and removed the global hooks from the command-hooks table.
- Clarified in `docs/command-hooks.md` that global hooks cannot be defined inside a workspace's `command-hooks`.

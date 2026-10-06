# Plan 1: Simplify Monorepo Configuration and Enforce Grouped Proposals

## Goal
Remove the `groupProposals` option from the `review` configuration since we have decided that PRs will **always** be grouped in monorepo mode. Following this logic, we will streamline the workspace-level patch schemas by removing fields that affect the global PR or global commits, as they are no longer relevant at the per-workspace level.

## Open Questions
- Is there any plan to allow per-workspace `workingBranchNameTemplate` in the future if we somehow implement per-workspace PRs? Assuming no based on current discussion.
- Should the PR body construction logic in `proposal.ts` be refactored as part of this plan, or will that be a follow-up phase? (This plan assumes the schema changes happen first, and `proposal.ts` will be handled separately as you mentioned: "then in logic where i deicding to constrcut pr body...").

## Proposed Changes

### 1. `src/schemas/configs/modules/review-config.ts`
- **Main Schema (`ReviewConfigSchema`)**:
  - Remove `groupProposals`.
  - Delete `reviewGroupProposalsSchema` and `reviewGroupProposalsDesc`.
- **Patch Schema (`ReviewConfigPatchSchema`)**:
  - Remove ALL fields that affect the global PR state: `draft`, `groupProposals`, `workingBranchNameTemplate`, `titleTemplate`, `titleTemplatePath`, `headerTemplate`, `headerTemplatePath`, `footerTemplate`, `footerTemplatePath`, `labels`, `assignees`, `reviewers`.
  - **Keep** only `bodyTemplate` and `bodyTemplatePath`. This allows each workspace to define its own template for its section of the grouped PR body.

### 2. `src/schemas/configs/modules/components/command-hook.ts`
- **Patch Schema (`CommandHooksPatchSchema`)**:
  - Remove `preCommit`, `postCommit`, and `postProposal`. Since commits and PRs are grouped globally, these hooks only make sense at the root level and should not be available in workspace configs.

### 3. `src/schemas/configs/workspace-member-config.ts`
- Keep `review: v.optional(ReviewConfigPatchSchema)`, but update its metadata description to indicate that it only configures the workspace-specific PR body template.
- Update `commandHooks` metadata description to clarify that global hooks (`preCommit`, `postCommit`, `postProposal`) are only configured at the root.

### 4. `src/run.ts`
- Remove the runtime validation block that throws an error when `!configResult.config.review.groupProposals`.

### 5. Documentation Updates
We will update docs to reflect the new state, avoiding "changelog-style" explanations.
- **`docs/config-options.md`**:
  - Remove `review > group-proposals` entirely from the TOC and properties list.
- **`docs/workspace-config-options.md`**:
  - Update the `review` section to list only `body-template` and `body-template-path`.
  - Update the `command-hooks` section table to remove `pre-commit`, `post-commit`, and `post-proposal` (or explicitly state they are strictly root-only and not allowed in workspace config).
- **`docs/command-hooks.md`**:
  - Update the "Global Hook Behavior" note. Instead of saying they are silently ignored, clarify that `pre-commit`, `post-commit`, and `post-proposal` are strictly root-level configurations.
- **`docs/wip/improve-experimental-monorepo-support/phase-1.md`**:
  - Document the completed schema and logic simplifications.

## Verification Plan
### Manual Verification
- Run `deno task check` to ensure no type errors.
- Verify that `review.groupProposals` is completely gone from the generated JSON schemas.
- Verify that `workspace-member-v1.json` schema no longer allows `preCommit`, `postCommit`, `labels`, `assignees`, etc.

---

## Implementation Results (Phase 1)

In this phase, we established that PRs (proposals) will always be grouped in monorepo mode. By enforcing this behavior, we were able to greatly simplify the configuration schemas, especially at the per-workspace level.

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

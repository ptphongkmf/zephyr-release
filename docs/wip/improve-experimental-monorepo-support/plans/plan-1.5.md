# Plan 1.5: Prune Global Commit Fields

## The Problem
During Phase 1, we successfully removed global PR fields (e.g., `draft`, `labels`, `titleTemplate`) from the `review` object in workspace-level configuration overrides. However, we forgot to apply this same logic to the `commit` object.

In a grouped monorepo mode (where all changes are collected into a single release commit and a single PR), many commit fields only make sense at the root level.

## Analysis of Commit Fields
Currently, `CommitConfigSchema` contains:
- `localChangesToCommit`
- `headerTemplate` & `headerTemplatePath`
- `bodyTemplate` & `bodyTemplatePath`
- `footerTemplate` & `footerTemplatePath`

### 1. Header and Footer (Global)
Because there is only **one** commit created per release in monorepo mode (via `commitChangesToBranch` in both `auto` and `review` flows), the header and footer of that commit govern the entire release. These must be defined globally at the root config.

### 2. Body Template (Per-Workspace Supported)
Similar to how the PR body can be composed of individual workspace sections, the commit body can also be grouped by package heading. Therefore, `bodyTemplate` and `bodyTemplatePath` should remain available for workspaces to define their own section of the global commit message.

### 3. Local Changes to Commit (Per-Workspace Supported)
In `src/workflows/review.prepare.ts` and `src/workflows/auto.ts`, `prepareChangesToCommit` is called **per-workspace**. It collects file changes relative to the workspace's path. This means `localChangesToCommit` is already functioning on a per-workspace basis and should remain allowed in workspace overrides.

## Proposed Action
1. Modify `CommitConfigPatchSchema` in `src/schemas/configs/modules/commit-config.ts` to `Omit` the global fields:
   - `headerTemplate`
   - `headerTemplatePath`
   - `footerTemplate`
   - `footerTemplatePath`
2. Update `docs/workspace-config-options.md` to reflect that the `commit` override only supports `local-changes-to-commit`, `body-template`, and `body-template-path`.

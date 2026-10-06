# Phase C.1: Fix merged workspace config schema

Design analysis: [draft-3-error-merged-config-type.md](../drafts/draft-3-error-merged-config-type.md)

## Problem

`deepMergeWorkspaceConfig` re-validated the merged config through `ConfigSchema`. Valibot strips unknown keys, so workspace-only fields (`title`, `review.memberBodyTemplate`, etc.) were silently dropped. The type `ConfigOutput` was also too narrow to access these fields downstream.

## Solution implemented

Created `ResolvedConfigSchema` in `src/schemas/configs/resolved-config.ts` using `v.strictObject` that spreads:

1. All root fields (from `ConfigSchema`, minus `workspace`)
2. All workspace member fields (from `WorkspaceMemberConfigSchema`)

Workspace member fields win on key conflicts (they appear last in the spread). The monorepo deep-merge path now re-validates through `ResolvedConfigSchema` instead of `ConfigSchema`, preserving all workspace-specific fields.

`ResolvedWorkspace.config` is now typed as `ResolvedConfig` throughout.

## Renames completed

All `*PatchSchema` → `*WorkspaceMemberSchema` across 10 files:

| Old name | New name | File |
| --- | --- | --- |
| `BumpStrategyConfigPatchSchema` | `BumpStrategyConfigWorkspaceMemberSchema` | `bump-strategy-config.ts` |
| `ChangelogConfigPatchSchema` | `ChangelogConfigWorkspaceMemberSchema` | `changelog-config.ts` |
| `CommitConfigPatchSchema` | `CommitConfigWorkspaceMemberSchema` | `commit-config.ts` |
| `TagConfigPatchSchema` | `TagConfigWorkspaceMemberSchema` | `tag-config.ts` |
| `ReleaseConfigPatchSchema` | `ReleaseConfigWorkspaceMemberSchema` | `release-config.ts` |
| `ReviewConfigPatchSchema` | `ReviewConfigWorkspaceMemberSchema` | `review-config.ts` |
| `AutoConfigPatchSchema` | `AutoConfigWorkspaceMemberSchema` | `auto-config.ts` |
| `CommandHooksPatchSchema` | `CommandHooksWorkspaceMemberSchema` | `command-hook.ts` |
| `BumpRuleCorePatchSchema` | `BumpRuleCoreWorkspaceMemberSchema` | `bump-rule-core.ts` |
| `BumpRuleExtensionPatchSchema` | `BumpRuleExtensionWorkspaceMemberSchema` | `bump-rule-extension.ts` |

## `v.unwrap()` audit completed

**Rule applied**: `v.unwrap()` is only kept when the base entry is `v.pipe(schema, v.metadata(...))` wrapping a schema that is itself `v.optional()` without a default (unwrap strips the metadata pipe to get the inner schema). For fields where the base is a plain `v.optional(schema)` (no nested pipe), the unwrap was redundant and removed.

**Removed** (35+ calls across `tag-config.ts`, `commit-config.ts`, `release-config.ts`, `changelog-config.ts`): all were `v.unwrap(Base.entries.field)` where `Base.entries.field` is already a `v.pipe(v.optional(schema), v.metadata(...))` — unwrapping it strips the metadata but changes nothing about validation behaviour. These now reference the base entry directly.

**Kept** (8 calls in `command-hook.ts`): The hook fields at root (`preRun`, etc.) are `v.pipe(commandHookCommandsSchema, v.metadata(...))` where `commandHookCommandsSchema` is itself `v.pipe(v.optional(...), v.transform(...))`. Unwrapping strips the outer metadata pipe and exposes the inner optional+transform schema, which is correct for the workspace member variant.

## `name` field type note

`ResolvedConfigSchema` inherits the optional `name` from `BaseConfigSchema`. In single-repo mode, we dynamically construct `{ ...rootConfig, title: rootConfig.name ?? "root" }` instead of blindly casting, which perfectly satisfies the schema without `as unknown` overhead. Monorepo-specific blocks use `invariant(wsConfig.name, ...)` to narrow the type safely where required.

## Files changed

- `src/schemas/configs/resolved-config.ts` — **[NEW]** `ResolvedConfigSchema` + `ResolvedConfig` type
- `src/types/workspace-context.ts` — `config` type changed from `ConfigOutput` to `ResolvedConfig`
- `src/tasks/workspace-resolver.ts` — monorepo path uses `ResolvedConfigSchema`; single-repo path casts with comment
- `src/schemas/configs/workspace-member-config.ts` — updated all imports
- `src/schemas/configs/modules/bump-strategy-config.ts` — renamed + updated imports
- `src/schemas/configs/modules/changelog-config.ts` — renamed + removed unwraps
- `src/schemas/configs/modules/commit-config.ts` — renamed + removed unwraps
- `src/schemas/configs/modules/tag-config.ts` — renamed + removed unwraps
- `src/schemas/configs/modules/release-config.ts` — renamed + removed unwraps
- `src/schemas/configs/modules/review-config.ts` — renamed
- `src/schemas/configs/modules/auto-config.ts` — renamed
- `src/schemas/configs/modules/components/command-hook.ts` — renamed (unwraps kept)
- `src/schemas/configs/modules/components/bump-rule-core.ts` — renamed
- `src/schemas/configs/modules/components/bump-rule-extension.ts` — renamed

## Verification

`deno task check` — passes with 0 errors.

## Refactorings completed

The following refactorings were identified and addressed alongside the typing fixes:

1. **`title` fallback on `ReleaseContextEntry`**: Resolved `title` during workspace resolution (`workspace-resolver.ts`) instead of in `format_proposal_body`. `ReleaseContextEntry.title` is now `string` (non-optional).
2. **`name` fallback patterns**: Fallbacks (`?? "root"` or `?? ""`) remain at the callsites. Type safety in monorepo blocks is handled via `invariant()`.
3. **`format_releases` renamed**: Renamed to `format_release_tags` everywhere to be more descriptive.
4. **Docs Synced**: Updated `docs/export-variables.md` and `docs/string-templates-and-patterns.md` to accurately reflect the `"root"` fallback for single-repo mode without a name.
5. **`ReleaseContextEntry` moved**: Moved from `pattern-context.ts` to `src/types/release-context.ts`, keeping a re-export for backward compatibility.
6. **Replaced `ConfigOutput` with `ResolvedConfig` in Workspace Loop**: Refactored the `config` argument in all workspace-level functions (like `commit.ts`, `changelog.ts`, `calculate-version.ts`) to be typed as `ResolvedConfig` (or subsets like `Pick<ResolvedConfig, ...>`). Renamed these arguments to `resolvedConfig`.

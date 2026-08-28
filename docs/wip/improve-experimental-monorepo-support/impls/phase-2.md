# Phase 2: Naming cleanup and `isMonorepo` pattern context

## Completed work

### 1. `ResolvedWorkspace.isMonorepoMember` removed entirely

The `isWorkspace` (later `isMonorepoMember`) field on the `ResolvedWorkspace` object was completely removed. It was a set-only field that was never read in the codebase, since `runSettings.isMonorepoMode` already provides this exact same information to any caller handling workspaces.

Changed files:
- `src/types/workspace-context.ts` — removed field from `ResolvedWorkspace`
- `src/tasks/workspace-resolver.ts` — removed the field from both single-repo and monorepo resolution paths

### 2. `isWorkspace` removed from `ReleaseContextEntry`

As documented in `plan-2.md`, the field was redundant. In any given run, either all entries have `isMonorepoMember: true` (monorepo) or the single entry has `isMonorepoMember: false` (single-repo). There is no mixed case. Template authors can use `{{ isMonorepo }}` instead.

Changed files:
- `src/tasks/string-templates-and-patterns/pattern-context.ts` — removed `isWorkspace` from `ReleaseContextEntry`
- `src/workflows/review.prepare.ts` — removed `isWorkspace` from `releaseEntries.push(...)`
- `src/workflows/review.publish.ts` — removed `isWorkspace` from `releaseEntries.push(...)` and from the internal `WorkspacePublishData` interface
- `src/workflows/auto.ts` — removed `isWorkspace` from `releaseEntries.push(...)`

### 3. `{{ isMonorepo }}` string pattern registered

Mirrors `ZR_IS_MONOREPO` from the export variables system. Set to `true` in monorepo mode, `false` in single-repo mode.

- Added `"isMonorepo"` to `FixedBaseStringPattern` union in `src/types/string-patterns.ts`
- Merged `isMonorepo` directly into `addBasePatternContext` in `src/tasks/string-templates-and-patterns/pattern-context.ts` so it is available from the earliest point in the lifecycle (bootstrap)
- Updated `src/workflows/bootstrap.ts` and `src/tasks/runtime-override.ts` to pass `isMonorepoMode` into `addBasePatternContext`
- Updated `docs/string-templates-and-patterns.md` — added `{{ isMonorepo }}` entry to the Base section, updated `{{ releases }}` description to clarify it holds one entry per workspace in monorepo mode

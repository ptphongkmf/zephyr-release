# Phase 4: Remove File-Based Runtime Config Override

## Background

Zephyr Release previously supported two methods for runtime config overrides:

1. **File-based** (`runtime-config-override` config property) — A script writes a JSON/YAML/TOML file to disk, and ZR reads it after each hook.
2. **Stdout-based** (stdout capture with marker delimiters) — A hook prints JSON between `---zephyr-release-config-override-start---` / `---zephyr-release-config-override-end---` markers.

Stdout capture was added in Phase 3 (monorepo) and is strictly superior:
- Works per-workspace (file-based is global-only)
- No filesystem side effects (no temp file to create/clean up)
- Simpler mental model (one mechanism instead of two)
- Hooks can still `curl` or call external tools and pipe to stdout

This is a **breaking change** — users with `runtime-config-override` in their config will need to migrate to stdout markers. Since the monorepo feature already triggers a major version bump, this is the right time.

## Proposed Changes

### Source Code

#### [DELETE] `src/schemas/configs/modules/components/runtime-config-override.ts`
Remove the `RuntimeConfigOverrideSchema` and its exported types entirely.

#### [MODIFY] `src/schemas/configs/modules/base-config.ts`
- Remove `import { RuntimeConfigOverrideSchema }` 
- Remove the `runtimeConfigOverride` property from the schema

#### [MODIFY] `src/schemas/configs/modules/components/command-hook.ts`
- Remove reference to `runtimeConfigOverride` in the `preCalculateVersion` hook description (line ~65)

#### [MODIFY] `src/schemas/configs/modules/review-config.ts`
- Update `workingBranchNameTemplate` description: change "`runtimeConfigOverride`" to "stdout config override" in immutability note (line ~43)

#### [MODIFY] `src/schemas/configs/modules/workspace-member-config.ts`
- Remove `runtimeConfigOverride` from the comment listing global-only fields (line ~15)

#### [MODIFY] `src/tasks/runtime-override.ts`
- Delete `resolveRuntimeConfigOverride()` function entirely (lines 45-117)
- Delete `ResolvedRuntimeConfigResult` interface
- Remove `getTextFile` import (only used by file-based override)
- Keep: `extractOverrideFromStdout()`, `synchronizeRuntimeStateAfterOverride()`
- Update JSDoc on `synchronizeRuntimeStateAfterOverride` — remove mention of `resolveRuntimeConfigOverride`

#### [MODIFY] `src/workflows/hook-runner.ts`
- Remove import of `resolveRuntimeConfigOverride`
- Remove the entire `isPerWorkspaceHook` parameter (no longer needed — all hooks use stdout now)
- Remove section 3 (file-based override block, lines 134-157)
- Update JSDoc to remove file-based override mention
- Simplify: the function now only does stdout extraction

#### Callers of `executeHookWithOverride`
The `isPerWorkspaceHook` parameter is removed. All callers passing `true` or `false` for the last arg will need that arg removed:
- `src/workflows/auto.ts`
- `src/workflows/review.prepare.ts`
- `src/workflows/review.publish.ts`

### Documentation

#### [MODIFY] `docs/config-options.md`
- Remove TOC entries for `runtime-config-override`, `runtime-config-override > path`, `runtime-config-override > format` (lines ~182-184)
- Remove the full `runtime-config-override` property section (lines ~1784-1817)
- Update `working-branch-name-template` immutability note — change reference from `runtime-config-override` to stdout override (line ~274)
- Update the `pre-calculate-version` hook description that references `runtime-config-override` (line ~1601)

#### [MODIFY] `docs/command-hooks.md`
- Update all `*(If overridden runtime config is returned, it applies moving forward).*` notes — clarify this refers to stdout-based config override
- Update the monorepo section's stdout override description (if it mentions file-based)

#### [MODIFY] `docs/export-variables.md`
- Update `ZR_CONFIG` and `ZR_INTERNAL_CONFIG` descriptions — change `runtime-config-override` link to mention stdout config override instead (lines ~241, ~248)

#### [MODIFY] `README.md`
- Rewrite "Dynamic Configuration Overrides" section:
  - Remove "Runtime File Override" (method 2)
  - Replace with "Runtime Stdout Override" explaining marker delimiters
  - Keep "Workflow Input Override" (method 1) unchanged

#### [MODIFY] `docs/workspace-config-options.md`
- Check for any remaining references to file-based override

### Internal docs (implementation notes)
These are dev-only references, not user-facing. Mark as historical:
- `docs/monorepo/implementations/2_post-test.md` (line ~88)
- `docs/monorepo/implementations/3_monorepo-implementation-mid-problem.md` (line ~219)
- `docs/monorepo/implementations/dynamic-override-consult.md` (lines ~20, ~367)

## Verification Plan

### Type Checking
```bash
deno check src/**/*.ts
```

### Manual Verification
- Grep the entire `src/` and `docs/` for any remaining references to `runtimeConfigOverride` or `runtime-config-override`

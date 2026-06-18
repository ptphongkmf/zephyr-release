# Phase 3: Monorepo Implementation

> **Scope:** Full monorepo support.
> **Breaking changes:** Major version bump — new `workspace` config key, new tag defaults, stdout-based config override, env/output variable changes.
> **Prerequisites:** Phase 1 (tag match patterns), Phase 2 (pure context + format_releases)
> **Design references:**
> - [3_monorepo-implementation-mid-problem.md](./3_monorepo-implementation-mid-problem.md) — design decisions
> - [dynamic-override-consult.md](./dynamic-override-consult.md) — override architecture

This plan is organized into sub-phases. They should be implemented **in order** within a single major release branch. Type check (`deno task check`) after each sub-phase.

> **Public-facing changes** (schema descriptions, docs, command-hooks behavior, etc.) are tracked separately in [docs-update-list.md](./docs-update-list.md) so they can be applied to all `.md` docs at the end.

---

## Sub-Phase 3A: Schema & Config Foundation

### Goal
Define workspace member schema, review.groupProposals, workspace key on root, tag defaults, override markers, and env var sanitizers.

---

### [NEW] [workspace-member-config.ts](file:///g:/Projects/Coding/zephyr-release/src/schemas/configs/modules/workspace-member-config.ts)
Workspace member config schema. Cherry-picks per-workspace overridable fields from existing schemas:

```typescript
import * as v from "@valibot/valibot";
import { BaseCoreConfigSchema } from "./base-config.ts";
import { BumpStrategyConfigSchema } from "./bump-strategy-config.ts";
import { ChangelogConfigSchema } from "./changelog-config.ts";
import { CommitConfigSchema } from "./commit-config.ts";
import { TagConfigSchema } from "./tag-config.ts";
import { ReleaseConfigSchema } from "./release-config.ts";
import { ReviewConfigSchema } from "./review-config.ts";
import { AutoConfigSchema } from "./auto-config.ts";
import { CommandHooksSchema } from "./components/command-hook.ts";

// Cherry-pick from BaseCoreConfigSchema — include per-workspace fields only
// OMIT: releaseFlow, timeZone, customStringPatterns, maxCommitsToResolve,
//       resolveUntilCommitHash, runtimeConfigOverride (these are global)
// INCLUDE: name (REQUIRED), versionFiles, commitTypes, allowedReleaseAsCommitTypes,
//          initialVersion, commandHooks

export const WorkspaceMemberConfigSchema = v.pipe(
  v.object({
    // name is REQUIRED (not optional like root)
    name: v.pipe(
      v.string(),
      v.trim(),
      v.nonEmpty(),
      v.metadata({
        description:
          "Workspace member name. Required. Used in tags, env vars, and outputs.\n" +
          "For env/output variable naming, characters invalid in shell identifiers are replaced " +
          "with underscore (see export-variables docs for the exact rules).",
      }),
    ),

    // Per-workspace overrides (all optional, inherit from root via deepMerge)
    initialVersion: BaseCoreConfigSchema.entries.initialVersion,
    versionFiles: BaseCoreConfigSchema.entries.versionFiles,
    commitTypes: BaseCoreConfigSchema.entries.commitTypes,
    allowedReleaseAsCommitTypes: BaseCoreConfigSchema.entries.allowedReleaseAsCommitTypes,

    bumpStrategy: v.optional(BumpStrategyConfigSchema),
    changelog: v.optional(ChangelogConfigSchema),
    commit: v.optional(CommitConfigSchema),
    tag: v.optional(TagConfigSchema),
    release: v.optional(ReleaseConfigSchema),

    // Per-workspace review overrides
    // postCommit and postProposal hooks are ignored when groupProposals: true
    review: v.optional(ReviewConfigSchema),

    auto: v.optional(AutoConfigSchema),

    // Per-workspace command hooks (merged with root via deepMerge — field-level inheritance)
    // Hooks that fire per-workspace: preCalculateVersion, postCalculateVersion,
    // preTag, preRelease, postRelease
    // Hooks that fire globally only (ignored here): preRun, postRun
    // Hooks that fire globally in grouped mode (with desc note): preCommit, postCommit, postProposal
    commandHooks: v.pipe(
      v.optional(CommandHooksSchema),
      v.metadata({
        description:
          "Per-workspace command hook overrides. Merged with root command-hooks via field-level inheritance.\n" +
          "Only per-workspace hooks are used (preCalculateVersion, postCalculateVersion, preTag, preRelease, postRelease).\n" +
          "preRun and postRun always use root hooks.\n" +
          "preCommit, postCommit, and postProposal are ignored when review.groupProposals is true.",
      }),
    ),
  }),
  v.metadata({
    title: "Zephyr Release workspace member configuration",
    description: "Configuration for an individual workspace member in a monorepo.",
  }),
);

export type WorkspaceMemberConfigInput = v.InferInput<typeof WorkspaceMemberConfigSchema>;
export type WorkspaceMemberConfigOutput = v.InferOutput<typeof WorkspaceMemberConfigSchema>;
```

**Not included in workspace member schema (global-only):**
- `releaseFlow`, `timeZone`, `customStringPatterns`
- `maxCommitsToResolve`, `resolveUntilCommitHash`
- `runtimeConfigOverride` (global mechanism — see dynamic-override-consult.md)

---

### [MODIFY] [review-config.ts](file:///g:/Projects/Coding/zephyr-release/src/schemas/configs/modules/review-config.ts)
Add `groupProposals` property:

```typescript
groupProposals: v.pipe(
  v.optional(v.boolean(), true),
  v.metadata({
    description:
      "When true (default), all workspace changes are grouped into a single proposal.\n" +
      "When false, each workspace gets its own proposal with its own working branch.\n" +
      "Only meaningful in monorepo mode.\n" +
      "Default: true",
  }),
),
```

---

### [MODIFY] [config.ts](file:///g:/Projects/Coding/zephyr-release/src/schemas/configs/config.ts)
Add `workspace` property:

```typescript
workspace: v.pipe(
  v.optional(
    v.record(trimNonEmptyStringSchema, WorkspaceMemberConfigSchema)
  ),
  v.metadata({
    description:
      "Workspace members for monorepo mode. Each key is the relative path " +
      "from repo root to the workspace directory (e.g., 'packages/core').\n" +
      "If omitted, Zephyr Release operates in single-repo mode.",
  }),
),
```

---

### [MODIFY] [string-templates.ts](file:///g:/Projects/Coding/zephyr-release/src/constants/defaults/string-templates.ts)
Add monorepo-specific defaults:

```typescript
export const DEFAULT_WORKSPACE_TAG_NAME_TEMPLATE =
  liquid`{{ name }}-v{{ nextVersion }}`;

export const DEFAULT_WORKSPACE_WORKING_BRANCH_NAME_TEMPLATE =
  "zephyr-release/{{ name }}/{{ triggerBranchName }}";
```

---

### [NEW] [override-markers.ts](file:///g:/Projects/Coding/zephyr-release/src/constants/override-markers.ts)
Stdout capture marker delimiters for runtime config override:

```typescript
export const OVERRIDE_MARKERS = {
  configStart: "ZR_CONFIG_OVERRIDE_START",
  configEnd: "ZR_CONFIG_OVERRIDE_END",
} as const;
```

Consistent with existing marker pattern in `markers.ts` (`CHANGELOG_MARKERS`, `PROPOSAL_MARKERS`).

---

### [MODIFY] [case.ts](file:///g:/Projects/Coding/zephyr-release/src/utils/transformers/case.ts)
Add workspace name sanitizers (custom, no @std/ dependency for this):

```typescript
/**
 * Sanitize a workspace name for use in environment variable names.
 * Replaces any character that is not [a-zA-Z0-9_] with underscore.
 */
export function sanitizeNameForEnv(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

/**
 * Sanitize a workspace name for use in GitHub Actions output names.
 * Replaces any character that is not [a-zA-Z0-9_-] with underscore.
 */
export function sanitizeNameForOutput(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/** Workspace-specific env key: ZR__<sanitized_name>__<CONSTANT_VAR> */
export function toWorkspaceEnvKey(workspaceName: string, varName: string): string {
  return "ZR__" + sanitizeNameForEnv(workspaceName) + "__" + toConstantCase(varName);
}

/** Workspace-specific output key: zr--<sanitized_name>--<kebab-var> */
export function toWorkspaceOutputKey(workspaceName: string, varName: string): string {
  return "zr--" + sanitizeNameForOutput(workspaceName) + "--" + toKebabCase(varName);
}
```

---

### [MODIFY] [gen-json-schema.ts](file:///g:/Projects/Coding/zephyr-release/scripts/gen-json-schema.ts)
Add workspace member config schema generation (3 casing variants).

---

## Sub-Phase 3B: Workspace Resolution & Release Context

### Goal
Build workspace resolution logic, types, and deepMerge config merger with Valibot validation.

---

### [NEW] [workspace-context.ts](file:///g:/Projects/Coding/zephyr-release/src/types/workspace-context.ts)

```typescript
import type { ConfigOutput } from "../schemas/configs/config.ts";

export interface ResolvedWorkspace {
  /** Workspace name (from config) */
  name: string;
  /** Relative path from repo root */
  path: string;
  /** Fully merged config (root defaults + workspace overrides) */
  config: ConfigOutput;
  /** Whether this is a workspace member (true) or root/single-repo (false) */
  isWorkspace: boolean;
}
```

### [MODIFY] [operation-context.ts](file:///g:/Projects/Coding/zephyr-release/src/types/operation-context.ts)
Add to `OperationRunSettings`:

```typescript
isMonorepoMode: boolean;
workspaces: ResolvedWorkspace[];
```

---

### [NEW] [workspace-resolver.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/workspace-resolver.ts)

```typescript
import { deepMerge } from "@std/collections";
import * as v from "@valibot/valibot";
import { ConfigSchema, type ConfigOutput } from "../schemas/configs/config.ts";
import type { ResolvedWorkspace } from "../types/workspace-context.ts";
import { formatValibotIssues } from "../utils/formatters/valibot.ts";
import { DEFAULT_WORKSPACE_TAG_NAME_TEMPLATE, DEFAULT_WORKSPACE_WORKING_BRANCH_NAME_TEMPLATE } from "../constants/defaults/string-templates.ts";

/**
 * Resolves workspace configs by deep-merging root config with per-workspace overrides.
 * For single-repo, returns a single-item array with isWorkspace=false.
 */
export function resolveWorkspaces(
  rootConfig: ConfigOutput,
  rawConfig: object,
): ResolvedWorkspace[] {
  const workspaceEntries = rootConfig.workspace;

  if (!workspaceEntries) {
    return [{
      name: rootConfig.name ?? "root",
      path: ".",
      config: rootConfig,
      isWorkspace: false,
    }];
  }

  return Object.entries(workspaceEntries).map(([path, memberConfig]) => {
    const mergedConfig = deepMergeWorkspaceConfig(rootConfig, memberConfig, path);
    return {
      name: memberConfig.name,
      path,
      config: mergedConfig,
      isWorkspace: true,
    };
  });
}

function deepMergeWorkspaceConfig(
  root: ConfigOutput,
  member: WorkspaceMemberConfigOutput,
  workspacePath: string,
): ConfigOutput {
  const merged = deepMerge(root, member, { arrays: "replace" });

  // Apply monorepo tag/branch defaults if user didn't explicitly set them
  // (check against raw member config, not the merged result)
  if (!member.tag?.nameTemplate) {
    merged.tag.nameTemplate = DEFAULT_WORKSPACE_TAG_NAME_TEMPLATE;
  }
  if (!member.review?.workingBranchNameTemplate) {
    merged.review.workingBranchNameTemplate = DEFAULT_WORKSPACE_WORKING_BRANCH_NAME_TEMPLATE;
  }

  const result = v.safeParse(ConfigSchema, merged);
  if (!result.success) {
    throw new Error(
      `Failed to merge workspace config for "${member.name}" at "${workspacePath}": ` +
        formatValibotIssues(result.issues),
    );
  }

  return result.output;
}
```

---

## Sub-Phase 3C: Override System Refactor — Utility Extraction + Stdout Capture

### Goal
- Extract the 14 duplicated override blocks into a single utility function
- Implement stdout-based config override via marker delimiters
- Keep file-based override at global level
- Modify `runCommands` / `runChildProcess` to capture stdout

---

### [MODIFY] [command.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/command.ts)
Change `runChildProcess` from `stdio: "inherit"` to `stdio: ["inherit", "pipe", "inherit"]` (stdin=inherit, stdout=pipe, stderr=inherit).

Modify `runCommands` to return captured stdout alongside the result summary:

```typescript
interface RunCommandsResult {
  summary: string | undefined;
  /** Combined stdout from all hook commands in this invocation */
  capturedStdout: string;
}

export async function runCommands(
  commandHooks: CommandHooksOutput | undefined,
  kind: CommandHookKind,
): Promise<RunCommandsResult> {
  // ... existing logic
  // For each command, capture stdout and pass through to logger
  // After all commands, return { summary, capturedStdout }
}
```

The captured stdout is then scanned for `OVERRIDE_MARKERS` by the override utility.

---

### [MODIFY] [runtime-override.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/runtime-override.ts)
Add stdout parsing function:

```typescript
import { OVERRIDE_MARKERS } from "../constants/override-markers.ts";

/**
 * Extract config override JSON from captured stdout using marker delimiters.
 * Returns undefined if no markers found.
 */
export function extractOverrideFromStdout(stdout: string): string | undefined {
  const startIdx = stdout.indexOf(OVERRIDE_MARKERS.configStart);
  const endIdx = stdout.indexOf(OVERRIDE_MARKERS.configEnd);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return undefined;

  return stdout
    .substring(startIdx + OVERRIDE_MARKERS.configStart.length, endIdx)
    .trim();
}
```

---

### [NEW] [hook-runner.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/hook-runner.ts)
The single utility that replaces all 14 duplicated override blocks:

```typescript
import type { CommandHookKind, CommandHooksOutput } from "../schemas/configs/modules/components/command-hook.ts";
import type { OperationRunSettings } from "../types/operation-context.ts";
import type { StringPatternContext } from "./string-templates-and-patterns/pattern-context.ts";
import type { SemVer } from "@std/semver";
import { runCommands } from "./command.ts";
import { resolveRuntimeConfigOverride, synchronizeRuntimeStateAfterOverride, extractOverrideFromStdout } from "./runtime-override.ts";
import { logger } from "./logger.ts";

interface HookRunnerOptions {
  nextVersion?: SemVer;
  currentVersion?: SemVer;
}

interface HookRunnerResult {
  runSettings: OperationRunSettings;
  patternContext: StringPatternContext;
}

/**
 * Execute a hook and apply runtime config override if applicable.
 *
 * For global hooks: checks both stdout capture and file-based override.
 * For per-workspace hooks: checks stdout capture only (no file-based, avoids cross-contamination).
 */
export async function executeHookWithOverride(
  hookKind: CommandHookKind,
  commandHooks: CommandHooksOutput | undefined,
  runSettings: OperationRunSettings,
  patternContext: StringPatternContext,
  options: HookRunnerOptions = {},
  isPerWorkspaceHook: boolean = false,
): Promise<HookRunnerResult> {
  // 1. Run hook commands and capture stdout
  logger.stepStart(`Starting: Execute ${hookKind} commands`);
  const hookResult = await runCommands(commandHooks, hookKind);
  if (hookResult.summary) {
    logger.stepFinish(`Finished: Execute ${hookKind} commands. ${hookResult.summary}`);
  } else {
    logger.stepSkip(`Skipped: Execute ${hookKind} commands (empty)`);
  }

  // 2. Try stdout-based override (always available)
  let overrideApplied = false;
  const stdoutOverride = extractOverrideFromStdout(hookResult.capturedStdout);
  if (stdoutOverride) {
    // Parse and merge stdout override
    // ... parse, deepMerge, validate, synchronize
    overrideApplied = true;
  }

  // 3. Try file-based override (global hooks only)
  if (!isPerWorkspaceHook && !overrideApplied) {
    const fileResult = await resolveRuntimeConfigOverride(
      runSettings.rawConfig, runSettings.config, runSettings.inputs.workspacePath,
    );
    if (fileResult) {
      runSettings = { ...runSettings, rawConfig: fileResult.rawResolvedRuntime, config: fileResult.resolvedRuntime };
      patternContext = await synchronizeRuntimeStateAfterOverride({
        provider, config: runSettings.config, rawConfig: runSettings.rawConfig,
        triggerBranchName: runSettings.inputs.triggerBranchName,
        currentPatternContext: patternContext,
        ...options,
      });
      overrideApplied = true;
    }
  }

  if (overrideApplied) {
    logger.stepFinish(`Finished: Resolve runtime config override (${hookKind})`);
  } else {
    logger.stepSkip(`Skipped: Resolve runtime config override (${hookKind})`);
  }

  return { runSettings, patternContext };
}
```

---

### [MODIFY] [auto.ts](file:///g:/Projects/Coding/zephyr-release/src/workflows/auto.ts), [review.prepare.ts](file:///g:/Projects/Coding/zephyr-release/src/workflows/review.prepare.ts), [review.publish.ts](file:///g:/Projects/Coding/zephyr-release/src/workflows/review.publish.ts), [run.ts](file:///g:/Projects/Coding/zephyr-release/src/run.ts)

Replace all ~14 inline override blocks with single-line `executeHookWithOverride(...)` calls.

**Before (repeated 14 times):**
```typescript
logger.stepStart("Starting: Execute preCalculateVersion commands");
const preCalcResult = await runCommands(runSettings.config.commandHooks, "preCalculateVersion");
// ... 15 more lines of override boilerplate ...
```

**After:**
```typescript
({ runSettings, patternContext } = await executeHookWithOverride(
  "preCalculateVersion", runSettings.config.commandHooks,
  runSettings, patternContext, { nextVersion, currentVersion },
));
```

---

## Sub-Phase 3D: Release-As Parsing & Path Resolution

### Goal
Standalone changes that don't depend on the workflow refactor.

---

### [MODIFY] [commit.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/commit.ts)
Add `parseReleaseAsFooter`:

```typescript
/**
 * Parse Release-As footer for monorepo support.
 *   Release-As: 2.0.0              → global
 *   Release-As: core@2.0.0         → workspace-specific
 *   Release-As: core@2.0.0, cli@3.0.0  → multiple workspace-specific
 *   Release-As: @scope/pkg@1.0.0   → scoped (uses lastIndexOf("@"))
 */
export function parseReleaseAsFooter(
  value: string,
): { global?: string; workspaces: Map<string, string> } {
  const result = { global: undefined as string | undefined, workspaces: new Map<string, string>() };
  const parts = value.split(",").map(s => s.trim()).filter(Boolean);

  for (const part of parts) {
    const lastAtIndex = part.lastIndexOf("@");
    if (lastAtIndex === -1 || lastAtIndex === 0) {
      result.global = part;
    } else {
      const name = part.substring(0, lastAtIndex);
      const version = part.substring(lastAtIndex + 1);
      result.workspaces.set(name, version);
    }
  }
  return result;
}
```

---

### [MODIFY] [changelog.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/changelog.ts)
Prepend workspace path to changelog file path when not `"."`:

```typescript
const changelogFilePath = workspacePath === "."
  ? config.changelog.path
  : `${workspacePath}/${config.changelog.path}`;
```

### [MODIFY] [version-file.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/version-files/version-file.ts)
Same treatment for version file paths.

---

## Sub-Phase 3E: Affected Workspace Detection

### Goal
Determine which workspaces have commits since their last release.

---

### [NEW] [workspace-detection.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/workspace-detection.ts)

```typescript
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import type { ResolvedWorkspace } from "../types/workspace-context.ts";
import { buildMatchPatterns } from "./string-templates-and-patterns/match-patterns.ts";

export interface AffectedWorkspace extends ResolvedWorkspace {
  lastReleaseHash?: string;
  lastReleaseTagName?: string;
}

/**
 * For each workspace, find its last release tag and check if there are
 * new commits in that workspace's path since the last release.
 * Uses parallel API calls for efficiency.
 */
export async function detectAffectedWorkspaces(
  provider: PlatformProvider,
  workspaces: ResolvedWorkspace[],
  triggerCommitHash: string,
  maxCommitsToResolve: number,
): Promise<AffectedWorkspace[]> {
  const workspacesWithRelease = await Promise.all(
    workspaces.map(async (ws) => {
      const patterns = buildMatchPatterns(
        ws.config.tag.nameTemplate,
        ws.config.tag.matchPatterns,
      );
      const lastRelease = await provider.findLastReleaseHash(patterns);
      return {
        ...ws,
        lastReleaseHash: lastRelease?.hash,
        lastReleaseTagName: lastRelease?.tagName,
      };
    }),
  );

  const affected = await Promise.all(
    workspacesWithRelease.map(async (ws) => {
      const pathFilter = ws.path === "." ? undefined : ws.path;
      const commits = await provider.listCommitsInRange(
        triggerCommitHash, ws.lastReleaseHash, pathFilter, maxCommitsToResolve,
      ).catch(() => []);
      return commits.length > 0 ? ws : null;
    }),
  );

  return affected.filter((ws): ws is AffectedWorkspace => ws !== null);
}
```

---

## Sub-Phase 3F: Workflow Refactor — Workspace Loop

### Goal
Modify workflow orchestrators to loop over affected workspaces. This is the largest sub-phase.

---

### Hook Lifecycle in Monorepo Mode

| Hook | Fires at | Config source | Override method |
|---|---|---|---|
| `preRun` | Global (once) | Root only | File + stdout |
| `preCalculateVersion` | Per-workspace | Merged (root + workspace) | Stdout only |
| `postCalculateVersion` | Per-workspace | Merged (root + workspace) | Stdout only |
| `preCommit` | Global (once, after all workspaces) | Root only | File + stdout |
| `postCommit` | Global (once) | Root only | File + stdout |
| `postProposal` | Global (once) | Root only | File + stdout |
| `preTag` | Per-workspace | Merged (root + workspace) | Stdout only |
| `preRelease` | Per-workspace | Merged (root + workspace) | Stdout only |
| `postRelease` | Per-workspace | Merged (root + workspace) | Stdout only |
| `postRun` | Global (once) | Root only | File + stdout |

> In single-repo mode (no `workspace` key), behavior is identical to current — all hooks use root config with both file + stdout override.

---

### [MODIFY] [run.ts](file:///g:/Projects/Coding/zephyr-release/src/run.ts)
After config resolution, resolve workspaces and add to run settings:

```typescript
const workspaces = resolveWorkspaces(configResult.config, configResult.rawConfig);
const isMonorepoMode = configResult.config.workspace !== undefined;

if (isMonorepoMode && !configResult.config.review.groupProposals) {
  throw new Error(
    "Ungrouped proposals (review.groupProposals: false) are not yet supported. " +
    "Please set review.groupProposals to true or omit it (default)."
  );
}
```

---

### [MODIFY] [auto.ts](file:///g:/Projects/Coding/zephyr-release/src/workflows/auto.ts)
Refactor into workspace-aware loop:

```typescript
export async function executeAutoReleaseFlow(provider, runSettings, opts) {
  const { workspaces, isMonorepoMode } = runSettings;

  // Step 1: Detect affected workspaces
  const affectedWorkspaces = isMonorepoMode
    ? await detectAffectedWorkspaces(provider, workspaces, ...)
    : workspaces; // single-repo: all workspaces (just one)

  // Step 2: Per-workspace prepare loop
  const releaseEntries: ReleaseContextEntry[] = [];
  const allChangesData = new Map<string, string | null>();
  for (const ws of affectedWorkspaces) {
    if (isMonorepoMode) logger.subHeader(`Workspace: ${ws.name}`);

    // Export ZR_NAME for this workspace
    provider.setEnv("ZR_NAME", ws.name);

    // Resolve commits (path-filtered in monorepo)
    const commits = await resolveCommitsForWorkspace(provider, ws, runSettings);

    // Per-workspace hooks (preCalculateVersion, postCalculateVersion)
    // Uses merged commandHooks: deepMerge(root.commandHooks, ws.config.commandHooks)
    ({ runSettings, patternContext } = await executeHookWithOverride(
      "preCalculateVersion", ws.config.commandHooks,
      runSettings, patternContext, {}, true, // isPerWorkspaceHook=true
    ));

    // Calculate version, changelog, prepare files
    // ... accumulate into releaseEntries and allChangesData
  }

  // Step 3: Set releases context
  patternContext = addReleasesPatternContext(patternContext, releaseEntries);

  // Step 4: Global commit (preCommit/postCommit hooks — root config)
  ({ runSettings, patternContext } = await executeHookWithOverride(
    "preCommit", runSettings.config.commandHooks,
    runSettings, patternContext, {}, false, // isPerWorkspaceHook=false
  ));
  // ... commit all changes

  // Step 5: Per-workspace tags and releases
  for (const ws of affectedWorkspaces) {
    provider.setEnv("ZR_NAME", ws.name);

    ({ runSettings, patternContext } = await executeHookWithOverride(
      "preTag", ws.config.commandHooks,
      runSettings, patternContext, {}, true,
    ));
    await createTag(provider, commitHash, runSettings.inputs, ws.config);

    ({ runSettings, patternContext } = await executeHookWithOverride(
      "preRelease", ws.config.commandHooks,
      runSettings, patternContext, {}, true,
    ));
    await createRelease(provider, runSettings.inputs, ws.config);

    ({ runSettings, patternContext } = await executeHookWithOverride(
      "postRelease", ws.config.commandHooks,
      runSettings, patternContext, {}, true,
    ));
  }
}
```

---

### [MODIFY] [review.prepare.ts](file:///g:/Projects/Coding/zephyr-release/src/workflows/review.prepare.ts)
Same workspace-aware loop. For `groupProposals: true`:
- One working branch, one PR
- Per-workspace version calculation and changelog
- Aggregate changes into one commit
- Create/update one proposal

---

### [MODIFY] [review.publish.ts](file:///g:/Projects/Coding/zephyr-release/src/workflows/review.publish.ts)
On merge:
- Extract per-workspace versions from version files
- Create per-workspace tags and releases
- Per-workspace `preTag`/`preRelease`/`postRelease` hooks

---

### [MODIFY] [bootstrap.ts](file:///g:/Projects/Coding/zephyr-release/src/workflows/bootstrap.ts)
For `groupProposals: true`: behavior is identical to current (single working branch, single proposal lookup).

---

## Sub-Phase 3G: Exported Variables

### Goal
Update variable exports with workspace-namespaced variables and summary.

---

### [MODIFY] [export-variables.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/export-variables.ts)
Add workspace-aware export functions using `sanitizeNameForEnv` / `sanitizeNameForOutput`:

```typescript
export async function exportWorkspaceVariables(
  provider: PlatformProvider,
  currentWorkspace: ResolvedWorkspace,
  allWorkspaces: WorkspaceVariableData[],
) {
  // Current workspace shortcuts
  provider.setEnv("ZR_NAME", currentWorkspace.name);
  provider.setEnv("ZR_NEXT_VERSION", currentWorkspace.nextVersion);

  // Per-workspace namespaced variables
  for (const ws of allWorkspaces) {
    provider.setEnv(toWorkspaceEnvKey(ws.name, "nextVersion"), ws.nextVersion);
    provider.setOutput(toWorkspaceOutputKey(ws.name, "nextVersion"), ws.nextVersion);
  }

  // Global summary
  provider.setEnv("ZR_IS_MONOREPO", "true");
  provider.setEnv("ZR_WORKSPACES", JSON.stringify(allWorkspaces));
}
```

### [MODIFY] [operation-variables.ts](file:///g:/Projects/Coding/zephyr-release/src/types/operation-variables.ts)
Add workspace-aware variable types.

---

## Sub-Phase 3H: Documentation & Public-Facing Changes

### Goal
Apply all tracked public-facing changes from [docs-update-list.md](./docs-update-list.md).

---

### [NEW] [workspace-config-options.md](file:///g:/Projects/Coding/zephyr-release/docs/workspace-config-options.md)
Full reference for workspace member config options.

### [MODIFY] [config-options.md](file:///g:/Projects/Coding/zephyr-release/docs/config-options.md)
Add `workspace` property description with link to `workspace-config-options.md`.

### [MODIFY] [export-variables.md](file:///g:/Projects/Coding/zephyr-release/docs/export-variables.md)
Document workspace-namespaced env/output variables and sanitization rules.

### [MODIFY] [command-hooks.md](file:///g:/Projects/Coding/zephyr-release/docs/command-hooks.md)
Document:
- Which hooks are global vs per-workspace
- Per-workspace hook inheritance via deepMerge
- Stdout-based config override with marker delimiters
- `ZR_NAME` env var available during per-workspace hooks

### Schema description updates
Apply all items from the path resolution checklist in `3_monorepo-implementation-mid-problem.md` Section 4.

---

## Verification Plan

### Type Checking
```bash
deno task check
```

### Local Logic Testing (experiments/)
- `experiments/workspace-resolver.ts` — config merging, monorepo tag defaults, Valibot validation
- `experiments/release-as-parser.ts` — Release-As footer parsing
- `experiments/workspace-detection-dry.ts` — path filtering logic
- `experiments/stdout-override-extract.ts` — marker delimiter extraction

### JSON Schema Regeneration
```bash
deno run -A scripts/gen-json-schema.ts
```
Verify both root config and workspace config schemas in all 3 casing variants.

### Post-Test (Manual)
See [3_post-test.md](./3_post-test.md) for full integration testing.

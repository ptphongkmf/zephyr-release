# Phase 3: Monorepo Implementation

> **Scope:** Full monorepo support.  
> **Breaking changes:** Major version bump — new `workspace` config key, new tag defaults in monorepo mode, env/output variable changes.  
> **Prerequisites:** Phase 1 (tag match patterns), Phase 2 (pure context + format_releases)

This plan is organized into sub-phases for readability. They should be implemented **in order** within a single major release branch.

---

## Sub-Phase 3A: Schema & Config Foundation

### Goal
Define the `workspace` config schema, the `WorkspaceMemberConfigSchema`, `review.groupProposals`, and the JSON schema generation for workspace configs.

---

### [NEW] [workspace-member-config.ts](file:///g:/Projects/Coding/zephyr-release/src/schemas/configs/modules/workspace-member-config.ts)
Define the workspace member config schema by composing entries from existing schemas:

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
import { trimNonEmptyStringSchema } from "../../string.ts";

// Cherry-pick from BaseCoreConfigSchema — include per-workspace fields only
// OMIT: releaseFlow, timeZone, customStringPatterns, maxCommitsToResolve,
//       resolveUntilCommitHash (these are global)
// INCLUDE: name (REQUIRED), versionFiles, commitTypes, allowedReleaseAsCommitTypes,
//          initialVersion

export const WorkspaceMemberConfigSchema = v.pipe(
  v.object({
    // name is REQUIRED in workspace (not optional like root)
    name: v.pipe(
      v.string(),
      v.trim(),
      v.nonEmpty(),
      v.metadata({
        description: "Workspace member name. Required. Used in tags, env vars, and outputs.",
      }),
    ),

    // Per-workspace overrides (all optional, inherit from root)
    initialVersion: BaseCoreConfigSchema.entries.initialVersion,
    versionFiles: BaseCoreConfigSchema.entries.versionFiles,
    commitTypes: BaseCoreConfigSchema.entries.commitTypes,
    allowedReleaseAsCommitTypes: BaseCoreConfigSchema.entries.allowedReleaseAsCommitTypes,

    bumpStrategy: v.optional(BumpStrategyConfigSchema, {}),
    changelog: v.optional(ChangelogConfigSchema, {}),
    commit: v.optional(CommitConfigSchema, {}),
    tag: v.optional(TagConfigSchema, {}),
    release: v.optional(ReleaseConfigSchema, {}),

    // Per-workspace review overrides (ignored when group-proposals: true)
    review: v.optional(ReviewConfigSchema, {}),

    // Per-workspace auto overrides (only triggerStrategy)
    auto: v.optional(AutoConfigSchema, {}),
  }),
  v.metadata({
    title: "Zephyr Release workspace member configuration",
    description: "Configuration for an individual workspace member in a monorepo.",
  }),
);

export type WorkspaceMemberConfigInput = v.InferInput<typeof WorkspaceMemberConfigSchema>;
export type WorkspaceMemberConfigOutput = v.InferOutput<typeof WorkspaceMemberConfigSchema>;
```

---

### [MODIFY] [review-config.ts](file:///g:/Projects/Coding/zephyr-release/src/schemas/configs/modules/review-config.ts)
Add `groupProposals` property:

```typescript
groupProposals: v.pipe(
  v.optional(v.boolean(), true),
  v.metadata({
    description:
      "When true (default), all workspace changes are grouped into a single proposal. " +
      "When false, each workspace gets its own proposal with its own working branch.\n" +
      "Only meaningful in monorepo mode.\n" +
      "Default: true",
  }),
),
```

---

### [MODIFY] [base-config.ts](file:///g:/Projects/Coding/zephyr-release/src/schemas/configs/modules/base-config.ts)
- Change `name` from `v.optional(...)` to remain optional (still optional at root level — only required in workspace members).

---

### [MODIFY] [config.ts](file:///g:/Projects/Coding/zephyr-release/src/schemas/configs/config.ts)
Add the `workspace` property to the root config schema:

```typescript
import { WorkspaceMemberConfigSchema } from "./modules/workspace-member-config.ts";

export const ConfigSchema = v.pipe(
  v.object({
    ...BaseCoreConfigSchema.entries,

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

    bumpStrategy: v.optional(BumpStrategyConfigSchema, {}),
    changelog: v.optional(ChangelogConfigSchema, {}),
    commit: v.optional(CommitConfigSchema, {}),
    tag: v.optional(TagConfigSchema, {}),
    release: v.optional(ReleaseConfigSchema, {}),

    ...BaseLifecycleConfigSchema.entries,
  }),
  // ...
);
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

### [MODIFY] [gen-json-schema.ts](file:///g:/Projects/Coding/zephyr-release/scripts/gen-json-schema.ts)
Add workspace member config schema generation:

```typescript
import { WorkspaceMemberConfigSchema } from "../src/schemas/configs/modules/workspace-member-config.ts";

// Generate separate workspace config JSON schemas
const baseWorkspaceSchema = toJsonSchema(WorkspaceMemberConfigSchema, { /* ... */ });

const WORKSPACE_SCHEMA_CONFIG: GenJsonSchemaConfig[] = [
  { outputFile: "workspace-config-v1.kebab.json", casingFn: toKebabCase },
  { outputFile: "workspace-config-v1.camel.json", casingFn: toCamelCase },
  { outputFile: "workspace-config-v1.snake.json", casingFn: toSnakeCase },
];
// ... same transform + write logic
```

---

## Sub-Phase 3B: Workspace Resolution & Release Context

### Goal
Build the workspace resolution logic that takes the parsed config and produces the `ReleaseContext[]` array — the list of affected workspaces with their resolved configs.

---

### New Types

#### [NEW] [workspace-context.ts](file:///g:/Projects/Coding/zephyr-release/src/types/workspace-context.ts)

```typescript
import type { ConfigOutput } from "../schemas/configs/config.ts";
import type { WorkspaceMemberConfigOutput } from "../schemas/configs/modules/workspace-member-config.ts";

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

#### [MODIFY] [operation-context.ts](file:///g:/Projects/Coding/zephyr-release/src/types/operation-context.ts)
Add `isMonorepoMode` to run settings:

```typescript
export interface OperationRunSettings {
  rawInputs: ProviderInputs;
  inputs: InputsOutput;
  rawConfig: object;
  config: ConfigOutput;
  isMonorepoMode: boolean;  // NEW
  workspaces: ResolvedWorkspace[];  // NEW: array of resolved workspace contexts
}
```

---

### Workspace Config Merger

#### [NEW] [workspace-resolver.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/workspace-resolver.ts)

```typescript
import type { ConfigOutput } from "../schemas/configs/config.ts";
import type { ResolvedWorkspace } from "../types/workspace-context.ts";
import { deepMerge } from "../utils/deep-merge.ts"; // or structuredClone + manual merge

/**
 * Resolves workspace configs by deep-merging root config with per-workspace overrides.
 * Returns an array of ResolvedWorkspace for each workspace member.
 *
 * For single-repo, returns a single-item array with isWorkspace=false.
 */
export function resolveWorkspaces(
  rootConfig: ConfigOutput,
  rawConfig: object,
): ResolvedWorkspace[] {
  const workspaceEntries = rootConfig.workspace;

  if (!workspaceEntries) {
    // Single-repo mode
    return [{
      name: rootConfig.name ?? "root",
      path: ".",
      config: rootConfig,
      isWorkspace: false,
    }];
  }

  // Monorepo mode
  return Object.entries(workspaceEntries).map(([path, memberConfig]) => {
    const mergedConfig = deepMergeWorkspaceConfig(rootConfig, memberConfig);
    return {
      name: memberConfig.name,
      path,
      config: mergedConfig,
      isWorkspace: true,
    };
  });
}

/**
 * Deep-merge root config with workspace overrides.
 * Workspace values take precedence. Root-only fields are preserved.
 */
function deepMergeWorkspaceConfig(
  root: ConfigOutput,
  member: WorkspaceMemberConfigOutput,
): ConfigOutput {
  // Start with root, override with workspace member values
  // Fields like releaseFlow, timeZone, customStringPatterns, etc. come from root
  // Fields like name, versionFiles, tag, changelog, etc. come from member (if set)
  return {
    ...root,
    name: member.name,
    versionFiles: member.versionFiles ?? root.versionFiles,
    initialVersion: member.initialVersion ?? root.initialVersion,
    commitTypes: member.commitTypes ?? root.commitTypes,
    allowedReleaseAsCommitTypes: member.allowedReleaseAsCommitTypes ?? root.allowedReleaseAsCommitTypes,
    bumpStrategy: deepMerge(root.bumpStrategy, member.bumpStrategy),
    changelog: deepMerge(root.changelog, member.changelog),
    commit: deepMerge(root.commit, member.commit),
    tag: deepMerge(root.tag, member.tag),
    release: deepMerge(root.release, member.release),
    review: deepMerge(root.review, member.review),
    auto: deepMerge(root.auto, member.auto),
  };
}
```

---

### Tag Defaults for Monorepo

#### [MODIFY] [workspace-resolver.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/workspace-resolver.ts)
After merging, if the workspace member did NOT explicitly provide `tag.nameTemplate`, override the default from `v{{ nextVersion }}` to `{{ name }}-v{{ nextVersion }}`:

```typescript
// If monorepo and user didn't explicitly set tag.nameTemplate for this workspace
if (!rawMemberConfig.tag?.nameTemplate) {
  mergedConfig.tag.nameTemplate = DEFAULT_WORKSPACE_TAG_NAME_TEMPLATE;
}

// Same for review.workingBranchNameTemplate
if (!rawMemberConfig.review?.workingBranchNameTemplate) {
  mergedConfig.review.workingBranchNameTemplate = DEFAULT_WORKSPACE_WORKING_BRANCH_NAME_TEMPLATE;
}
```

---

## Sub-Phase 3C: Affected Workspace Detection

### Goal
Determine which workspaces have commits since their last release using the path-filtered API approach.

---

#### [NEW] [workspace-detection.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/workspace-detection.ts)

```typescript
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import type { ResolvedWorkspace } from "../types/workspace-context.ts";
import { buildMatchPatterns } from "../utils/template-to-pattern.ts";

export interface AffectedWorkspace extends ResolvedWorkspace {
  lastReleaseHash?: string;
  lastReleaseTagName?: string;
}

/**
 * For each workspace, find its last release tag and check if there are
 * new commits in that workspace's path since the last release.
 *
 * Uses parallel path-filtered API calls for efficiency.
 */
export async function detectAffectedWorkspaces(
  provider: PlatformProvider,
  workspaces: ResolvedWorkspace[],
  triggerCommitHash: string,
  maxCommitsToResolve: number,
): Promise<AffectedWorkspace[]> {
  // Step 1: Find last release hash for each workspace
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

  // Step 2: For each workspace, check if there are commits in its path
  // Use path-filtered API calls (parallel)
  const affected = await Promise.all(
    workspacesWithRelease.map(async (ws) => {
      const pathFilter = ws.path === "." ? undefined : ws.path;
      const commits = await provider.listCommitsInRange(
        triggerCommitHash,
        ws.lastReleaseHash,
        pathFilter,
        maxCommitsToResolve,
      ).catch(() => []);  // No commits = not affected

      return commits.length > 0 ? ws : null;
    }),
  );

  return affected.filter((ws): ws is AffectedWorkspace => ws !== null);
}
```

---

## Sub-Phase 3D: Workflow Refactor — Workspace Loop

### Goal
Modify the workflow orchestrators to loop over affected workspaces. Each workspace gets its own version calculation, changelog, tag, and release.

---

### [MODIFY] [run.ts](file:///g:/Projects/Coding/zephyr-release/src/run.ts)
After config resolution, resolve workspaces and add to run settings:

```typescript
// After resolveConfig:
const workspaces = resolveWorkspaces(configResult.config, configResult.rawConfig);
const isMonorepoMode = configResult.config.workspace !== undefined;

let runSettings: OperationRunSettings = {
  rawInputs: inputsResult.rawInputs,
  inputs: inputsResult.inputs,
  rawConfig: configResult.rawConfig,
  config: configResult.config,
  isMonorepoMode,
  workspaces,
};
```

---

### [MODIFY] [auto.ts](file:///g:/Projects/Coding/zephyr-release/src/workflows/auto.ts)
Refactor into a workspace-aware loop. The high-level structure becomes:

```typescript
export async function executeAutoReleaseFlow(provider, runSettings, opts) {
  const { workspaces, isMonorepoMode } = runSettings;

  // Step 1: Detect affected workspaces
  const affectedWorkspaces = await detectAffectedWorkspaces(
    provider, workspaces, runSettings.inputs.triggerCommitHash,
    runSettings.config.maxCommitsToResolve,
  );

  if (affectedWorkspaces.length === 0) {
    throw new SafeExit("No workspaces have changes since their last release");
  }

  // Step 2: Per-workspace version calculation (per-workspace hooks fire here)
  const releaseEntries: ReleaseContextEntry[] = [];
  for (const ws of affectedWorkspaces) {
    if (isMonorepoMode) logger.subHeader(`Workspace: ${ws.name}`);

    // Resolve commits for this workspace (path-filtered)
    const commits = await resolveCommitsForWorkspace(provider, ws, runSettings);

    // Calculate version
    const currentVersion = await getCurrentVersion(provider, runSettings.inputs, ws.config);
    const nextVersion = calculateNextVersion(commits, ws.config, currentVersion);

    // Set workspace string context
    createFixedCurrentVersionStringPatternContext(currentVersion);
    createFixedNextVersionStringPatternContext(nextVersion);
    await createFixedTagStringPatternContext(ws.config.tag.nameTemplate);

    // Fire per-workspace hooks: preCalculateVersion, postCalculateVersion
    // ... (existing hook pattern)

    // Evaluate auto trigger strategy (per-workspace)
    evaluateAutoReleaseFlowTriggerStrategy(commits.entries, ws.config);

    // Generate changelog
    const changelog = await generatePrepareChangelogReleaseContent(...);

    // Collect for the releases array
    releaseEntries.push({
      name: ws.name,
      nextVersion: format(nextVersion),
      tagName: await resolveStringTemplate(ws.config.tag.nameTemplate),
      isWorkspace: ws.isWorkspace,
    });

    // Prepare files (version files, changelog) — paths relative to workspace
    const changesData = await prepareChangesToCommit(provider, runSettings.inputs, ws.config, nextVersion);
    // Accumulate all changes for the single commit
  }

  // Step 3: Set releases context for commit message template
  createReleasesStringPatternContext(releaseEntries);

  // Step 4: Global commit (preCommit/postCommit hooks fire here)
  // ... single commit with all workspace changes aggregated

  // Step 5: Per-workspace tags and releases
  for (const ws of affectedWorkspaces) {
    // preTag, preRelease, postRelease hooks fire per workspace
    await createTag(provider, commitHash, runSettings.inputs, ws.config);
    await createRelease(provider, runSettings.inputs, ws.config);
  }
}
```

---

### [MODIFY] [review.prepare.ts](file:///g:/Projects/Coding/zephyr-release/src/workflows/review.prepare.ts)
Same workspace-aware loop pattern. Two modes:

**When `review.groupProposals: true` (default):**
- One working branch, one PR.
- Per-workspace version calculation and changelog generation.
- Aggregate all changes into one commit on one branch.
- Create/update one proposal.

**When `review.groupProposals: false`:**
- Per-workspace working branches and PRs.
- For each workspace: calculate version, generate changelog, commit to workspace branch, create/update workspace PR.

---

### [MODIFY] [review.publish.ts](file:///g:/Projects/Coding/zephyr-release/src/workflows/review.publish.ts)
On merge of the proposal:
- Extract versions from version files (per workspace).
- Create per-workspace tags and releases.
- Fire per-workspace `preTag`/`preRelease`/`postRelease` hooks.

---

### [MODIFY] [bootstrap.ts](file:///g:/Projects/Coding/zephyr-release/src/workflows/bootstrap.ts)
Workspace-aware proposal lookup:
- When `group-proposals: true`, look for one proposal from the single working branch.
- When `group-proposals: false`, look for per-workspace proposals.

---

## Sub-Phase 3E: Exported Variables & Hooks

### Goal
Update variable export to support namespaced per-workspace variables.

---

### [MODIFY] [export-variables.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/export-variables.ts)
Add workspace-aware export functions:

```typescript
/**
 * Export per-workspace variables (called during per-workspace hook phases).
 * Sets ZR_NEXT_VERSION to current workspace value.
 * Also exports ZR__<name>__* for ALL workspaces.
 */
export async function exportWorkspaceVariables(
  provider: PlatformProvider,
  currentWorkspace: ResolvedWorkspace,
  allWorkspaces: WorkspaceVariableData[],
) {
  // Current workspace shortcuts
  provider.setEnv("ZR_NEXT_VERSION", currentWorkspace.nextVersion);
  provider.setEnv("ZR_NAME", currentWorkspace.name);
  provider.setOutput("zr-next-version", undefined); // undefined in monorepo

  // All workspace namespaced variables
  for (const ws of allWorkspaces) {
    provider.setEnv(`ZR__${ws.name}__NEXT_VERSION`, ws.nextVersion);
    provider.setOutput(`zr--${ws.name}--next-version`, ws.nextVersion);
    // ... other per-workspace variables
  }

  // Global summary
  provider.setEnv("ZR_WORKSPACES", JSON.stringify(allWorkspaces));
}
```

---

### [MODIFY] [operation-variables.ts](file:///g:/Projects/Coding/zephyr-release/src/types/operation-variables.ts)
Add workspace-aware variable types.

---

## Sub-Phase 3F: Release-As Parsing

### Goal
Support `Release-As: core@2.0.0, cli@3.0.0` syntax in commit footers.

---

### [MODIFY] [commit.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/commit.ts)
In the commit parsing logic, extend the `release-as` footer extraction:

```typescript
/**
 * Parse Release-As footer value for monorepo support.
 * Supports:
 *   Release-As: 2.0.0              → global (applies to all)
 *   Release-As: core@2.0.0         → workspace-specific
 *   Release-As: core@2.0.0, cli@3.0.0  → multiple workspace-specific
 */
export function parseReleaseAsFooter(
  value: string,
): { global?: string; workspaces: Map<string, string> } {
  const result = { global: undefined as string | undefined, workspaces: new Map<string, string>() };

  const parts = value.split(",").map(s => s.trim()).filter(Boolean);

  for (const part of parts) {
    const lastAtIndex = part.lastIndexOf("@");
    if (lastAtIndex === -1 || lastAtIndex === 0) {
      // No @ or only leading @ — treat as global version
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

## Sub-Phase 3G: Changelog Path Resolution

### Goal
Ensure changelog paths are resolved relative to workspace path.

---

### [MODIFY] [changelog.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/changelog.ts)
When preparing changelog file paths for commit, prepend workspace path:

```typescript
// In prepareChangelogFileToCommit or equivalent:
const changelogFilePath = workspacePath === "."
  ? config.changelog.path
  : `${workspacePath}/${config.changelog.path}`;
```

### [MODIFY] [version-files/version-file.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/version-files/version-file.ts)
Same treatment for version file paths.

---

## Sub-Phase 3H: Documentation

### Goal
Document workspace config options and migration guide.

---

### [NEW] [workspace-config-options.md](file:///g:/Projects/Coding/zephyr-release/docs/workspace-config-options.md)
Full reference for workspace member config. Structure mirrors `config-options.md`.

### [MODIFY] [config-options.md](file:///g:/Projects/Coding/zephyr-release/docs/config-options.md)
Add `workspace` property description with link to `workspace-config-options.md`.

### [MODIFY] [command-hooks.md](file:///g:/Projects/Coding/zephyr-release/docs/command-hooks.md)
Document which hooks are global vs per-workspace in monorepo mode.

---

## Verification Plan

### Type Checking
```bash
deno task check
```

### Local Logic Testing (experiments/)

#### `experiments/workspace-resolver.ts` — Test config merging
```typescript
import { resolveWorkspaces } from "../src/tasks/workspace-resolver.ts";

// Mock a root config with 2 workspaces
const rootConfig = {
  name: "monorepo-root",
  releaseFlow: "auto",
  tag: { nameTemplate: "v{{ nextVersion }}", createTag: true },
  workspace: {
    "packages/core": { name: "core" },
    "packages/cli": { name: "cli", tag: { nameTemplate: "cli-release-{{ nextVersion }}" } },
  },
  // ... other required fields with defaults
};

const resolved = resolveWorkspaces(rootConfig as any, rootConfig);
for (const ws of resolved) {
  console.log(`${ws.name} (${ws.path}): tag.nameTemplate = "${ws.config.tag.nameTemplate}"`);
}
// Expected:
// core (packages/core): tag.nameTemplate = "{{ name }}-v{{ nextVersion }}"  ← monorepo default applied
// cli (packages/cli): tag.nameTemplate = "cli-release-{{ nextVersion }}"    ← user override preserved
```

#### `experiments/release-as-parser.ts` — Test Release-As footer parsing
```typescript
import { parseReleaseAsFooter } from "../src/tasks/commit.ts";

const cases = [
  { input: "2.0.0", expectedGlobal: "2.0.0", expectedWs: 0 },
  { input: "core@2.0.0", expectedGlobal: undefined, expectedWs: 1 },
  { input: "core@2.0.0, cli@3.0.0", expectedGlobal: undefined, expectedWs: 2 },
  { input: "2.0.0, core@3.0.0", expectedGlobal: "2.0.0", expectedWs: 1 },
  { input: "@scope/pkg@1.0.0", expectedGlobal: undefined, expectedWs: 1 },
];

for (const { input, expectedGlobal, expectedWs } of cases) {
  const result = parseReleaseAsFooter(input);
  const globalOk = result.global === expectedGlobal;
  const wsOk = result.workspaces.size === expectedWs;
  console.log(`parseReleaseAsFooter("${input}")`);
  console.log(`  global: ${result.global} ${globalOk ? "✅" : `❌ expected ${expectedGlobal}`}`);
  console.log(`  workspaces: ${result.workspaces.size} entries ${wsOk ? "✅" : `❌ expected ${expectedWs}`}`);
  if (result.workspaces.size > 0) {
    for (const [name, version] of result.workspaces) {
      console.log(`    ${name} => ${version}`);
    }
  }
}
```

#### `experiments/workspace-detection-dry.ts` — Test path filtering logic (no API)
```typescript
// This tests the workspace detection logic without the API.
// Verifies that path="." returns undefined (no filter), and other paths are passed correctly.

const workspaces = [
  { name: "root", path: "." },
  { name: "core", path: "packages/core" },
  { name: "cli", path: "packages/cli" },
];

for (const ws of workspaces) {
  const pathFilter = ws.path === "." ? undefined : ws.path;
  console.log(`${ws.name}: pathFilter = ${pathFilter === undefined ? "undefined (no filter)" : `"${pathFilter}"`}`);
}
// Expected:
// root: pathFilter = undefined (no filter)
// core: pathFilter = "packages/core"
// cli: pathFilter = "packages/cli"
```

Run all with:
```bash
deno run -A experiments/workspace-resolver.ts
deno run -A experiments/release-as-parser.ts
deno run -A experiments/workspace-detection-dry.ts
```

### JSON Schema Regeneration
```bash
deno run -A scripts/gen-json-schema.ts
```
Verify both root config and workspace config schemas are generated in all 3 casing variants.

### Post-Test: Real GitHub API (Manual)

See [3_post-test.md](file:///g:/Projects/Coding/zephyr-release/docs/monorepo/implementations/3_post-test.md) for full integration testing on a real repository covering all 8 scenarios.


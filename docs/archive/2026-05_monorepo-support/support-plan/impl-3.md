# Monorepo Support — Implementation Decisions & Schema Design (Draft 3)

> **Status:** Draft / Technical Design  
> **Date:** 2026-05-25  
> **Scope:** Deep-dive into technical decisions for Zephyr Release's monorepo support, including detailed analyses of popular tools, dependency cascading limitations of hooks, schema design via Valibot programmatic overrides, JSON schema exporting, and resolution flows for inline/path-based configurations.

---

## 1. Industry Research: How Popular Tools Handle Monorepo Releases

To answer the first question regarding how other popular monorepo release tools operate, we analyze their strategies across four categories: **release grouping**, **tagging**, **change detection**, and **workspace configuration**.

| Tool | Config Model | Change Detection | Tag Naming | Release Grouping |
| :--- | :--- | :--- | :--- | :--- |
| **release-please** (Google) | Centralized manifest (`.release-please-manifest.json` + `release-please-config.json`) | Path-based filtering (analyzes files changed in each commit) | `<pkg-name>-v<version>` (defaults to component name) | **Separate Releases**: Even with a combined Release PR, once merged, it creates separate GitHub Releases 1:1 with Git tags. |
| **Changesets** (Vercel) | Centralized `.changeset` config + temporary markdown intent files | Manual/developer intent (explicit `.changeset/*.md` files) | `<pkg-name>@<version>` | **Separate Releases**: Creates individual GitHub Releases for each package tag when publishing. |
| **multi-semantic-release** | Wraps `semantic-release` configurations per package | Path-based or commit-scope filtering | `@scope/pkg-name@<version>` | **Separate Releases**: Since it runs a separate `semantic-release` process for each workspace, each gets its own independent GitHub Release 1:1 with its tag. |
| **Lerna / Nx Release** | Centralized project graph and workspace configuration | Git diff of package boundaries | `<pkg-name>@<version>` (independent) or `v<version>` (linked) | **Separate Releases**: Creates individual GitHub Releases mapping 1:1 to the generated package tags. |

### Key Insight: Why GitHub Releases are always 1:1 with Git Tags
Every major tool maps GitHub Releases **1:1 to Git tags/packages**. The reasoning is structural:
1. **GitHub's Architecture**: A GitHub Release is fundamentally a wrapper around a single Git tag. You cannot attach a single GitHub Release to multiple distinct Git tags (e.g. `core/v1.2.0` and `cli/v2.0.1`).
2. **Release Feeds & Downstream Consumption**: Downstream tooling, changelog parsers, and package managers monitor tags and releases per package. Grouping them into a single massive release note makes it impossible to query a specific package version's release body programmatically.
3. **Recommendation**: We will follow the community standard: **PRs can be grouped into one combined proposal PR, but GitHub Releases must always remain 1:1 with Git tags/packages**.

---

## 2. Dependency Graph & Hook Cascades: Active Implementation vs. Hooks

If `packages/cli` depends on `packages/core`, and `packages/core` receives a version bump, `packages/cli`'s configuration/dependencies must be updated. We analyzed if our current [command-hooks.md](file:///g:/Projects/Coding/zephyr-release/docs/command-hooks.md) system could allow users to implement this custom cascading behavior themselves, or if it requires active implementation.

### The Limits of Hooks in the Current Lifecycle
Suppose a user writes a script in `post-calculate-version` or `pre-commit` to inspect the version bump variables and update the version strings in dependent files (e.g. updating `packages/cli/package.json` to depend on the new version of `packages/core`).

While the modified files *would* be committed during the commit stage (since they are in the working directory), this approach breaks down because:
1. **Missing Git Tags**: Zephyr Release does not know that `packages/cli` was updated because it only calculates bumps based on git history. The hook cannot tell the parent process: *"Please also create a tag `cli/vX.Y.Z` for this run."*
2. **Missing GitHub Releases**: Since Zephyr Release's internal state is unaware of the cascading bump, no GitHub Release or release notes will be generated for `packages/cli`.
3. **Stale Changelogs**: The changelog for `packages/cli` will not mention the dependency bump or the new version.

### Conclusion
**Active implementation is required** inside Zephyr Release to support dependency graph awareness. Hooks are great for side-effects (e.g., building, publishing, notifications), but cannot dynamically alter the execution plan (tags, releases, changelogs) for other packages.
*   **Plan**: For v1, we will keep it simple and omit dependency-graph cascading (independent packages only). We will design the `VersionBumpIntent` collection to easily allow dependency-graph cascading logic to be injected directly into step 3 of the execution flow in the future.

---

## 3. The Root Package (`.`): "Leave it Dumb"

For Question 3, we agree with the "leave it dumb" approach. 

If the user specifies `.` (the repository root) as a workspace:
- It will match **every commit** by path.
- We will **not** write complex path-subtraction logic to remove child workspaces (like `packages/core/**`) from the root's path filter unless explicitly configured by the user.
- If developers want to prevent child package commits from bumping the root package, they can organize their repo structure accordingly or use the explicit paths. Leaving the root matching logic simple ("dumb") avoids hard-to-debug edge cases and lets the filesystem remain the source of truth.

---

## 4. Config Schema Design: Programmatic Valibot Overrides

To avoid duplicating our schemas or redefining every field from scratch for the workspace member config, we will utilize **`.entries` object destructuring** on Valibot schemas.

In Valibot, `v.object(entries)` exposes `.entries` as a plain JavaScript object mapping properties to their respective schemas. We can destructure it to omit, modify, or add fields.

Here is the implementation strategy to be added in `src/schemas/configs/modules/workspace-config.ts`:

```typescript
import * as v from "@valibot/valibot";
import { BaseCoreConfigSchema } from "./base-config.ts";
import { VersionFileSchema } from "./components/version-file.ts";
import { BumpStrategyConfigSchema } from "./bump-strategy-config.ts";
import { ChangelogConfigSchema } from "./changelog-config.ts";
import { CommitConfigSchema } from "./commit-config.ts";
import { TagConfigSchema } from "./tag-config.ts";
import { ReleaseConfigSchema } from "./release-config.ts";
import { trimNonEmptyStringSchema } from "../string.ts";

// 1. Destructure entries we want to override or omit from the root config schema
const {
  name: _ignoredName,          // We override this to make it required
  versionFiles: _ignoredVF,    // We override this to make it optional
  mode: _ignoredMode,          // Omit: workspaces cannot define their own mode
  review: _ignoredReview,      // Omit: workspaces cannot define their own review settings
  auto: _ignoredAuto,          // Omit: workspaces cannot define their own auto settings
  ...baseCoreEntries           // Keep the rest (timeZone, customStringPatterns, commitTypes, etc.)
} = BaseCoreConfigSchema.entries;

// 2. Define the schema for a single workspace member configuration
export const WorkspaceMemberConfigSchema = v.object({
  // Required name for monorepo workspaces
  name: v.pipe(
    v.string(),
    v.trim(),
    v.metadata({
      description: "Required workspace name, used for namespaced tags and release targeting."
    })
  ),

  // Make versionFiles optional in the workspace config (inherits from root if omitted)
  versionFiles: v.optional(
    v.pipe(
      v.union([
        VersionFileSchema,
        v.pipe(v.array(VersionFileSchema), v.nonEmpty()),
      ]),
      v.transform((input) => Array.isArray(input) ? input : [input]),
    )
  ),

  // Inherit remaining base fields
  ...baseCoreEntries,

  // Add the sub-config blocks, making them optional without default objects
  // (so they do not overwrite root configuration defaults when merging)
  bumpStrategy: v.optional(BumpStrategyConfigSchema),
  changelog: v.optional(ChangelogConfigSchema),
  commit: v.optional(CommitConfigSchema),
  tag: v.optional(TagConfigSchema),
  release: v.optional(ReleaseConfigSchema),
});

// 3. Define the main WorkspaceSchema supporting both path strings and inline configs
export const WorkspaceSchema = v.record(
  trimNonEmptyStringSchema, // e.g. "packages/core"
  v.union([
    trimNonEmptyStringSchema, // Path to workspace config, e.g. "packages/core/zephyr-pkg.json"
    WorkspaceMemberConfigSchema, // Inline workspace config override
  ]),
  v.metadata({
    description: "Map of monorepo workspaces, supporting either inline configurations or paths to external config files."
  })
);

export type WorkspaceMemberConfigInput = v.InferInput<typeof WorkspaceMemberConfigSchema>;
export type WorkspaceMemberConfigOutput = v.InferOutput<typeof WorkspaceMemberConfigSchema>;
```

---

## 5. Integrating with JSON Schema Export

To place the `WorkspaceMemberConfigSchema` in the definitions of the exported JSON schema (making the schema dry and readable), we simply register it in the `definitions` option of `toJsonSchema` inside [gen-json-schema.ts](file:///g:/Projects/Coding/zephyr-release/scripts/gen-json-schema.ts).

Here is the diff of the changes needed for the generation script:

```diff
  // Base config json schema based on valibot schema
  const baseSchema = toJsonSchema(ConfigSchema, {
    typeMode: "input",
-   definitions: { timeZone: TimeZoneSchema },
+   definitions: {
+     timeZone: TimeZoneSchema,
+     workspaceMemberConfig: WorkspaceMemberConfigSchema,
+   },
    ignoreActions: ["trim", "safe_integer", "to_lower_case"],
  });
```

The traversal logic in `gen-json-schema.ts` will automatically take care of:
1. Converting `$ref: "#/definitions/workspaceMemberConfig"` to `#/definitions/workspace-member-config` (kebab-casing).
2. Updating internal descriptions referencing the properties.

---

## 6. Workspace Resolution Flow (Inline & Path-Based)

To support both inline overrides and path-based configs, we implement a simple resolution check during config loading.

```typescript
import { parseConfig } from "./config-parser.ts";
import { getTextFile } from "../file.ts";
import { detectFileFormatFromPath } from "../../utils/parsers/file.ts";
import { transformObjKeyToCamelCase } from "../../utils/transformers/object.ts";

/**
 * Resolves each workspace configuration (supporting paths and inline structures),
 * validates them, and returns a map of normalized workspace config outputs.
 */
export async function resolveWorkspaces(
  provider: PlatformProvider,
  inputs: ResolveConfigInputsParams,
  rootWorkspaceConfig: Record<string, string | object>
): Promise<Record<string, WorkspaceMemberConfigOutput>> {
  const resolvedWorkspaces: Record<string, WorkspaceMemberConfigOutput> = {};

  for (const [workspacePath, configValue] of Object.entries(rootWorkspaceConfig)) {
    let rawWorkspaceConfig: object;

    if (typeof configValue === "string") {
      // 1. Path-based: read config file from the specified path
      const workspaceConfigText = await getTextFile(
        inputs.sourceMode ?? "remote",
        configValue,
        {
          provider,
          workspacePath: inputs.workspacePath,
          ref: inputs.triggerCommitHash,
        }
      );

      // 2. Parse config file, auto-detecting format from extension
      const parsedResult = parseConfig(
        workspaceConfigText,
        "auto",
        configValue
      );
      rawWorkspaceConfig = parsedResult.parsedConfig;
    } else {
      // 3. Inline: use the config object directly
      rawWorkspaceConfig = configValue;
    }

    // 4. Transform keys to camelCase for valibot parsing
    const camelCasedConfig = transformObjKeyToCamelCase(rawWorkspaceConfig);

    // 5. Validate workspace config against schema
    const parsedWorkspaceResult = v.safeParse(WorkspaceMemberConfigSchema, camelCasedConfig);
    if (!parsedWorkspaceResult.success) {
      throw new Error(
        `Validation of workspace config for '${workspacePath}' failed:\n` +
        formatValibotIssues(parsedWorkspaceResult.issues)
      );
    }

    resolvedWorkspaces[workspacePath] = parsedWorkspaceResult.output;
  }

  return resolvedWorkspaces;
}
```

---

## 7. Resolution of Remaining Open Decisions

| Decision / Question | Resolved Design / Behavior |
| :--- | :--- |
| **How to detect monorepo mode?** | **Implicitly**, by checking if `workspace` key is present in the parsed config. |
| **How to associate commits?** | **Path-based filtering** by default, with `zephyr-include` footer override inside commit messages. |
| **Proposal Strategy?** | **Combined PR** containing all package changes. Enabled by `review.group-pull-requests: true`. |
| **Commit Strategy?** | **Single commit** for all package version bumps and changelog updates. |
| **Tag naming?** | Configurable, but defaults to `{{ name }}/v{{ nextVersion }}` in monorepo mode. |
| **Per-package config inheritance?** | **Deep merge** over root configuration. Workspaces only override fields they specify. |
| **How to get file lists?** | Use provider-level changed files (`git diff-tree` for local mode, API compare endpoint for remote mode). |
| **Different `mode` values?** | **No**. Execution modes (review/auto) are global for the entire run. |
| **Commits touching multiple packages?** | Appears in the filtered list for each package; bumps them independently. |
| **`resolveUntilCommitHash`?** | **Global**. Controls the git timeline resolution window. |
| **`auto` mode loop detection sign?** | **Global**. Handled by checking sign on the commit level. |

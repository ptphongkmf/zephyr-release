import { deepMerge } from "@std/collections";
import * as v from "@valibot/valibot";
import { type ConfigOutput } from "../schemas/configs/config.ts";
import {
  type ResolvedConfig,
  ResolvedConfigSchema,
} from "../schemas/configs/resolved-config.ts";
import type { WorkspaceMemberConfigOutput } from "../schemas/configs/workspace-member-config.ts";
import type { ResolvedWorkspace } from "../types/workspace-context.ts";
import { formatValibotIssues } from "../utils/formatters/valibot.ts";
import {
  DEFAULT_WORKSPACE_TAG_NAME_TEMPLATE,
} from "../constants/defaults/string-templates.ts";

/**
 * Resolves workspace configs by deep-merging root config with per-workspace overrides.
 * For single-repo, returns a single-item array.
 */
export function resolveWorkspaces(
  rootConfig: ConfigOutput,
): ResolvedWorkspace[] {
  const workspaceEntries = rootConfig.workspace;

  if (!workspaceEntries) {
    // Single-repo mode. ResolvedConfig is a superset of ConfigOutput with workspace-only
    // fields added as optional; rootConfig satisfies it since those fields are undefined.
    return [{
      path: ".",
      config: {
        ...rootConfig,
        title: rootConfig.name ?? "root",
      },
    }];
  }

  // Monorepo mode
  return Object.entries(workspaceEntries).map(([path, memberConfig]) => {
    const mergedConfig = deepMergeWorkspaceConfig(
      rootConfig,
      memberConfig,
      path,
    );
    return {
      path,
      config: mergedConfig,
    };
  });
}

/**
 * Deep-merge root config with workspace member overrides.
 * Workspace values take precedence. Root-only fields are preserved.
 * Re-validates through ResolvedConfigSchema (not ConfigSchema) to preserve
 * workspace-only fields like `title` and `review.member*Template` that
 * ConfigSchema would strip as unknown keys.
 *
 * @throws if the merged config fails Valibot validation
 */
function deepMergeWorkspaceConfig(
  root: ConfigOutput,
  member: WorkspaceMemberConfigOutput,
  workspacePath: string,
): ResolvedConfig {
  const merged = structuredClone(
    deepMerge(root, member, { arrays: "replace" }),
  );

  merged.title = merged.title ?? merged.name;

  const result = v.safeParse(ResolvedConfigSchema, merged);
  if (!result.success) {
    throw new Error(
      `Failed to merge workspace config for "${member.name}" at "${workspacePath}": ` +
        formatValibotIssues(result.issues),
    );
  }

  // Apply monorepo tag defaults if the member did not explicitly set them.
  // We mutate result.output because deepMerge<T, U>'s recursive conditional type
  // hits TS instantiation limits on complex schemas, falling back to a looser type
  // where merged.tag becomes possibly undefined. result.output is safely typed.
  if (!member.tag?.nameTemplate) {
    result.output.tag.nameTemplate = DEFAULT_WORKSPACE_TAG_NAME_TEMPLATE;
  }

  return result.output;
}

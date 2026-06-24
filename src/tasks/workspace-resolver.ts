import { deepMerge } from "@std/collections";
import * as v from "@valibot/valibot";
import { ConfigSchema, type ConfigOutput } from "../schemas/configs/config.ts";
import type { WorkspaceMemberConfigOutput } from "../schemas/configs/modules/workspace-member-config.ts";
import type { ResolvedWorkspace } from "../types/workspace-context.ts";
import { formatValibotIssues } from "../utils/formatters/valibot.ts";
import {
  DEFAULT_WORKSPACE_TAG_NAME_TEMPLATE,
  DEFAULT_WORKSPACE_WORKING_BRANCH_NAME_TEMPLATE,
} from "../constants/defaults/string-templates.ts";

/**
 * Resolves workspace configs by deep-merging root config with per-workspace overrides.
 * For single-repo, returns a single-item array with isWorkspace=false.
 */
export function resolveWorkspaces(
  rootConfig: ConfigOutput,
): ResolvedWorkspace[] {
  const workspaceEntries = rootConfig.workspace;

  if (!workspaceEntries) {
    // Single-repo mode
    return [{
      path: ".",
      config: rootConfig,
      isWorkspace: false,
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
      isWorkspace: true,
    };
  });
}

/**
 * Deep-merge root config with workspace member overrides.
 * Workspace values take precedence. Root-only fields are preserved.
 * Always re-validates through ConfigSchema (never type-cast).
 *
 * @throws if the merged config fails Valibot validation
 */
function deepMergeWorkspaceConfig(
  root: ConfigOutput,
  member: WorkspaceMemberConfigOutput,
  workspacePath: string,
): ConfigOutput {
  const merged = deepMerge(root, member, { arrays: "replace" });

  // Apply monorepo tag/branch defaults if user didn't explicitly set them
  // (check against the member config, not the merged result)
  if (!member.tag?.nameTemplate) {
    merged.tag.nameTemplate = DEFAULT_WORKSPACE_TAG_NAME_TEMPLATE;
  }
  if (!member.review?.workingBranchNameTemplate) {
    merged.review.workingBranchNameTemplate =
      DEFAULT_WORKSPACE_WORKING_BRANCH_NAME_TEMPLATE;
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

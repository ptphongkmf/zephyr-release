import * as v from "@valibot/valibot";
import {
  allowedReleaseAsCommitTypesDesc,
  allowedReleaseAsCommitTypesSchema,
  type BaseConfigOutput,
  commitTypesDesc,
  commitTypesSchema,
  initialVersionDesc,
  initialVersionSchema,
  versionFilesDesc,
  versionFilesSchema,
} from "./base-config.ts";
import {
  BumpStrategyConfigWorkspaceMemberSchema,
} from "./modules/bump-strategy-config.ts";
import { ChangelogConfigWorkspaceMemberSchema } from "./modules/changelog-config.ts";
import { CommitConfigWorkspaceMemberSchema } from "./modules/commit-config.ts";
import { TagConfigWorkspaceMemberSchema } from "./modules/tag-config.ts";
import { ReleaseConfigWorkspaceMemberSchema } from "./modules/release-config.ts";
import { ReviewConfigWorkspaceMemberSchema } from "./modules/review-config.ts";
import { AutoConfigWorkspaceMemberSchema } from "./modules/auto-config.ts";
import { CommandHooksWorkspaceMemberSchema } from "./modules/components/command-hook.ts";
import { trimNonEmptyStringSchema } from "../string.ts";

// Cherry-pick from BaseCoreConfigSchema — include per-workspace fields only
// OMIT: releaseFlow, timeZone, customStringPatterns, maxCommitsToResolve,
//       resolveUntilCommitHash (these are global)
// INCLUDE: name (REQUIRED), review, auto, initialVersion, versionFiles,
//          commitTypes, allowedReleaseAsCommitTypes, bumpStrategy,
//          changelog, commit, tag, release, commandHooks

type WorkspaceMemberFields =
  & Omit<
    BaseConfigOutput,
    | "timeZone"
    | "customStringPatterns"
    | "releaseFlow"
    | "maxCommitsToResolve"
    | "resolveUntilCommitHash"
  >
  & {
    title?: string;
  };

export const WorkspaceMemberConfigSchema = v.pipe(
  v.object(
    {
      // name is REQUIRED (not optional like root)
      name: v.pipe(
        trimNonEmptyStringSchema,
        v.metadata({
          description:
            "Workspace member name. Required. Used in tags, env vars, and outputs.\n" +
            "For env/output variable naming, characters invalid in shell identifiers are replaced " +
            "with underscore (see export-variables docs for the exact rules).",
        }),
      ),

      // Optional display title for the workspace section heading in the proposal body.
      // If omitted, the `name` value is used as the heading.
      title: v.pipe(
        v.optional(trimNonEmptyStringSchema),
        v.metadata({
          description:
            "Display title for this workspace's section heading in the release proposal body.\n" +
            "The proposal body always uses this value as the heading; falls back to `name` if not set.\n" +
            "Does not affect tags, env vars, branch names, or any other computed value.",
        }),
      ),

      // Per-workspace review overrides
      // PRs are always grouped globally even in monorepo mode, so PR-level configs are root-only.
      review: v.optional(ReviewConfigWorkspaceMemberSchema),
      auto: v.optional(AutoConfigWorkspaceMemberSchema),

      // Per-workspace overrides (partially inherit from root via deepMerge)
      initialVersion: v.pipe(
        v.optional(initialVersionSchema),
        v.metadata({
          description: initialVersionDesc + "Default: inherit from root",
        }),
      ),
      versionFiles: v.pipe(
        versionFilesSchema,
        v.metadata({
          description:
            "Note: Unlike other fields, version files DO NOT inherit from root, they are required per-workspace.\n" +
            versionFilesDesc,
        }),
      ),

      commitTypes: v.pipe(
        v.optional(commitTypesSchema),
        v.metadata({
          description: commitTypesDesc + "Default: inherit from root",
        }),
      ),
      allowedReleaseAsCommitTypes: v.pipe(
        v.optional(allowedReleaseAsCommitTypesSchema),
        v.metadata({
          description: allowedReleaseAsCommitTypesDesc +
            "Default: inherit from root",
          examples: [
            "<COMMIT_TYPES>",
            ["<COMMIT_TYPES>", "chore", "ci", "cd"],
          ],
        }),
      ),

      bumpStrategy: v.optional(BumpStrategyConfigWorkspaceMemberSchema),
      changelog: v.optional(ChangelogConfigWorkspaceMemberSchema),
      commit: v.optional(CommitConfigWorkspaceMemberSchema),
      tag: v.optional(TagConfigWorkspaceMemberSchema),
      release: v.optional(ReleaseConfigWorkspaceMemberSchema),

      // Per-workspace command hooks (merged with root via deepMerge — field-level inheritance)
      // Hooks that fire per-workspace: preCalculateVersion, postCalculateVersion,
      // preTag, preRelease, postRelease
      // Hooks that fire globally only (omitted here): preRun, preCommit, postCommit, postProposal, postRun
      commandHooks: v.pipe(
        v.optional(CommandHooksWorkspaceMemberSchema),
        v.metadata({
          description:
            "Per-workspace command hook overrides. Merged with root command-hooks via field-level inheritance.\n" +
            "Only per-workspace hooks are used (preCalculateVersion, postCalculateVersion, preTag, preRelease, postRelease).\n" +
            "Global hooks (preRun, preCommit, postCommit, postProposal, postRun) are strictly root-only.",
        }),
      ),
    } satisfies Record<keyof WorkspaceMemberFields, unknown>,
  ),
  v.metadata({
    title: "Zephyr Release workspace member configuration",
    description:
      "Configuration for an individual workspace member in a monorepo.",
  }),
);

type _WorkspaceMemberConfigInput = v.InferInput<
  typeof WorkspaceMemberConfigSchema
>;
export type WorkspaceMemberConfigOutput = v.InferOutput<
  typeof WorkspaceMemberConfigSchema
>;

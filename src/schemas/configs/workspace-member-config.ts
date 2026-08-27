import * as v from "@valibot/valibot";
import {
  allowedReleaseAsCommitTypesDesc,
  allowedReleaseAsCommitTypesSchema,
  BaseCoreConfigOutput,
  BaseLifecycleConfigOutput,
  commitTypesDesc,
  commitTypesSchema,
  initialVersionDesc,
  initialVersionSchema,
  versionFilesDesc,
  versionFilesSchema,
} from "./base-config.ts";
import {
  BumpStrategyConfigPatchSchema,
} from "./modules/bump-strategy-config.ts";
import { ChangelogConfigPatchSchema } from "./modules/changelog-config.ts";
import { CommitConfigPatchSchema } from "./modules/commit-config.ts";
import { TagConfigPatchSchema } from "./modules/tag-config.ts";
import { ReleaseConfigPatchSchema } from "./modules/release-config.ts";
import { ReviewConfigPatchSchema } from "./modules/review-config.ts";
import { AutoConfigPatchSchema } from "./modules/auto-config.ts";
import { CommandHooksPatchSchema } from "./modules/components/command-hook.ts";
import { trimNonEmptyStringSchema } from "../string.ts";

// Cherry-pick from BaseCoreConfigSchema — include per-workspace fields only
// OMIT: releaseFlow, timeZone, customStringPatterns, maxCommitsToResolve,
//       resolveUntilCommitHash (these are global)
// INCLUDE: name (REQUIRED), review, auto, initialVersion, versionFiles,
//          commitTypes, allowedReleaseAsCommitTypes, bumpStrategy,
//          changelog, commit, tag, release, commandHooks

type WorkspaceMemberFields =
  & Omit<
    BaseCoreConfigOutput,
    | "timeZone"
    | "customStringPatterns"
    | "releaseFlow"
    | "maxCommitsToResolve"
    | "resolveUntilCommitHash"
  >
  & BaseLifecycleConfigOutput
  & {
    bumpStrategy: unknown;
    changelog: unknown;
    commit: unknown;
    tag: unknown;
    release: unknown;
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

      // Per-workspace review overrides
      // postCommit and postProposal hooks are ignored when groupProposals: true
      review: v.optional(ReviewConfigPatchSchema),
      auto: v.optional(AutoConfigPatchSchema),

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

      bumpStrategy: v.optional(BumpStrategyConfigPatchSchema),
      changelog: v.optional(ChangelogConfigPatchSchema),
      commit: v.optional(CommitConfigPatchSchema),
      tag: v.optional(TagConfigPatchSchema),
      release: v.optional(ReleaseConfigPatchSchema),

      // Per-workspace command hooks (merged with root via deepMerge — field-level inheritance)
      // Hooks that fire per-workspace: preCalculateVersion, postCalculateVersion,
      // preTag, preRelease, postRelease
      // Hooks that fire globally only (ignored here): preRun, postRun
      // Hooks that fire globally in grouped mode (with desc note): preCommit, postCommit, postProposal
      commandHooks: v.pipe(
        v.optional(CommandHooksPatchSchema),
        v.metadata({
          description:
            "Per-workspace command hook overrides. Merged with root command-hooks via field-level inheritance.\n" +
            "Only per-workspace hooks are used (preCalculateVersion, postCalculateVersion, preTag, preRelease, postRelease).\n" +
            "preRun and postRun always use root hooks.\n" +
            "preCommit, postCommit, and postProposal are ignored when review.groupProposals is true.",
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

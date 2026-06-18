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
import { trimNonEmptyStringSchema } from "../../string.ts";

// Cherry-pick from BaseCoreConfigSchema — include per-workspace fields only
// OMIT: releaseFlow, timeZone, customStringPatterns, maxCommitsToResolve,
//       resolveUntilCommitHash, runtimeConfigOverride (these are global)
// INCLUDE: name (REQUIRED), versionFiles, commitTypes, allowedReleaseAsCommitTypes,
//          initialVersion, commandHooks

export const WorkspaceMemberConfigSchema = v.pipe(
  v.object({
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

    // Per-workspace overrides (all optional, inherit from root via deepMerge)
    initialVersion: BaseCoreConfigSchema.entries.initialVersion,
    versionFiles: BaseCoreConfigSchema.entries.versionFiles,
    commitTypes: BaseCoreConfigSchema.entries.commitTypes,
    allowedReleaseAsCommitTypes:
      BaseCoreConfigSchema.entries.allowedReleaseAsCommitTypes,

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

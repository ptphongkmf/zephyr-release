import * as v from "@valibot/valibot";
import {
  BaseCoreConfigSchema,
  BaseLifecycleConfigSchema,
} from "./modules/base-config.ts";
import { BumpStrategyConfigSchema } from "./modules/bump-strategy-config.ts";
import { ReleaseConfigSchema } from "./modules/release-config.ts";
import { ChangelogConfigSchema } from "./modules/changelog-config.ts";
import { CommitConfigSchema } from "./modules/commit-config.ts";
import { TagConfigSchema } from "./modules/tag-config.ts";

export const ConfigSchema = v.pipe(
  v.object({
    ...BaseCoreConfigSchema.entries,

    bumpStrategy: v.optional(BumpStrategyConfigSchema, {}),

    changelog: v.optional(ChangelogConfigSchema, {}),

    commit: v.optional(CommitConfigSchema, {}),

    tag: v.optional(TagConfigSchema, {}),

    release: v.optional(ReleaseConfigSchema, {}),

    ...BaseLifecycleConfigSchema.entries,
  }),
  v.metadata({
    title: "Zephyr Release configuration file",
    description:
      "A JSON representation of a Zephyr Release configuration file.",
  }),
);

type _ConfigInput = v.InferInput<typeof ConfigSchema>;
export type ConfigOutput = v.InferOutput<typeof ConfigSchema>;

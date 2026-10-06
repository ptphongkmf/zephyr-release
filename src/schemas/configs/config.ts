import * as v from "@valibot/valibot";
import { BaseConfigSchema } from "./base-config.ts";
import { WorkspaceMemberConfigSchema } from "./workspace-member-config.ts";
import { trimNonEmptyStringSchema } from "../string.ts";

export const ConfigSchema = v.pipe(
  v.object({
    ...BaseConfigSchema.entries,

    workspace: v.pipe(
      v.optional(
        v.record(trimNonEmptyStringSchema, WorkspaceMemberConfigSchema),
      ),
      v.metadata({
        description:
          "Workspace members for monorepo mode. Each key is the relative path " +
          'from repo root to the workspace directory (e.g., "packages/core").\n' +
          "If omitted, Zephyr Release operates in single-repo mode.",
      }),
    ),
  }),
  v.metadata({
    title: "Zephyr Release configuration file",
    description:
      "A JSON representation of a Zephyr Release configuration file.",
  }),
);

type _ConfigInput = v.InferInput<typeof ConfigSchema>;
export type ConfigOutput = v.InferOutput<typeof ConfigSchema>;

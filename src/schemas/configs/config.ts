import * as v from "@valibot/valibot";
import {
  BaseConfigSchema,
  versionFilesDesc,
  versionFilesSchema,
} from "./base-config.ts";
import { WorkspaceMemberConfigSchema } from "./workspace-member-config.ts";
import { trimNonEmptyStringSchema } from "../string.ts";

const RootConfigSchema = v.object({
  ...BaseConfigSchema.entries,

  // Overridden to optional here so monorepo configs can declare `versionFiles`
  // inside each `workspace` member instead of at the root.
  // The actual logic for `versionFiles` (required when single-repo, omitted and
  // disallowed at root when `workspace` is set) is enforced by the partial checks
  // inside `ConfigSchema` below, and mirrored into JSON Schema via
  // `overrideAction` in `scripts/gen-json-schema.ts`.
  versionFiles: v.pipe(
    v.optional(versionFilesSchema),
    v.metadata({ description: versionFilesDesc }),
  ),

  workspace: v.pipe(
    v.optional(
      v.pipe(
        v.record(trimNonEmptyStringSchema, WorkspaceMemberConfigSchema),
        v.minEntries(1),
      ),
    ),
    v.metadata({
      description:
        "Workspace members for monorepo mode. Each key is the relative path " +
        'from repo root to the workspace directory (e.g., "packages/core").\n' +
        "If omitted, Zephyr Release operates in single-repo mode.",
    }),
  ),
});

// Exported as constants (instead of inlined strings) so `scripts/gen-json-schema.ts`
// can match each inline `partialCheck` inside `overrideAction` by message without
// pulling the checks out of `v.pipe(...)` (which loses contextual type inference)
// or relying on fragile `ConfigSchema.pipe[index]` positions.
export const ROOT_VERSION_FILES_REQUIRED_MSG =
  'Missing required "versionFiles" (required at root when "workspace" is not configured)';
export const ROOT_VERSION_FILES_FORBIDDEN_MSG =
  '"versionFiles" cannot be set at root when "workspace" is configured (define it inside each workspace member instead)';

export const ConfigSchema = v.pipe(
  RootConfigSchema,
  v.forward(
    v.partialCheck(
      [["versionFiles"], ["workspace"]],
      (input) =>
        input.workspace !== undefined || input.versionFiles !== undefined,
      ROOT_VERSION_FILES_REQUIRED_MSG,
    ),
    ["versionFiles"],
  ),
  v.forward(
    v.partialCheck(
      [["versionFiles"], ["workspace"]],
      (input) =>
        !(input.workspace !== undefined && input.versionFiles !== undefined),
      ROOT_VERSION_FILES_FORBIDDEN_MSG,
    ),
    ["versionFiles"],
  ),
  v.metadata({
    title: "Zephyr Release configuration file",
    description:
      "A JSON representation of a Zephyr Release configuration file.",
  }),
);

type _ConfigInput = v.InferInput<typeof ConfigSchema>;
export type ConfigOutput = v.InferOutput<typeof ConfigSchema>;

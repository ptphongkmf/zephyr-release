import * as v from "@valibot/valibot";
import { SourceModeSchema } from "./source-mode.ts";
import { ConfigFileFormatsWithAuto } from "../../constants/file-formats.ts";
import { SourceModeOptions } from "../../constants/source-mode-options.ts";

export const InputsSchema = v.pipe(
  v.object({
    token: v.pipe(v.string(), v.trim(), v.nonEmpty("Token is missing")),

    triggerCommitHash: v.pipe(
      v.string(),
      v.trim(),
      v.nonEmpty("Commit hash not found"),
    ),
    triggerBranchName: v.pipe(
      v.string(),
      v.trim(),
      v.nonEmpty("Branch name not found"),
    ),
    workspacePath: v.pipe(
      v.string(),
      v.trim(),
      v.nonEmpty("Workspace not found"),
    ),

    configPath: v.pipe(v.string(), v.trim()),
    configFormat: v.optional(v.enum(ConfigFileFormatsWithAuto), "auto"),

    configOverride: v.pipe(v.string(), v.trim()),
    configOverrideFormat: v.optional(v.enum(ConfigFileFormatsWithAuto), "auto"),

    sourceMode: v.pipe(
      v.union([v.enum(SourceModeOptions), SourceModeSchema]),
      v.transform((input) =>
        typeof input === "string" ? { mode: input, overrides: {} } : input
      ),
    ),
  }),
  // custom checks
  v.forward(
    v.partialCheck(
      [["configPath"], ["configOverride"]],
      (input) =>
        Boolean(input.configPath) ||
        Boolean(input.configOverride),
      "At least one of `config-path` or `config-override` is required",
    ),
    ["configPath"],
  ),
  v.forward(
    v.partialCheck(
      [["configPath"], ["configOverride"]],
      (input) =>
        Boolean(input.configPath) ||
        Boolean(input.configOverride),
      "At least one of `config-path` or `config-override` is required",
    ),
    ["configOverride"],
  ),
);

type _InputsInput = v.InferInput<typeof InputsSchema>;
export type InputsOutput = v.InferOutput<typeof InputsSchema>;

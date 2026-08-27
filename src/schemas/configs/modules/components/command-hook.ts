import * as v from "@valibot/valibot";
import { DOCS_EXT_REF_TOKEN } from "../../../token.ts";
import { CommandSchema } from "./command.ts";
import { ConfigFileFormatsWithAuto } from "../../../../constants/file-formats.ts";

const commandHookCommandsSchema = v.pipe(
  v.optional(
    v.union([CommandSchema, v.pipe(v.array(CommandSchema), v.nonEmpty())]),
  ),
  v.transform((input) => {
    if (input !== undefined) return Array.isArray(input) ? input : [input];
    return input;
  }),
);

type _CommandHookCommandsInput = v.InferInput<typeof commandHookCommandsSchema>;
type _CommandHookCommandsOutput = v.InferOutput<
  typeof commandHookCommandsSchema
>;

const commandHookTimeoutSchema = v.pipe(
  v.union([
    v.pipe(v.number(), v.minValue(1), v.safeInteger()),
    v.literal(Infinity),
    v.literal("Infinity"),
    v.literal("infinity"),
  ]),
  v.transform((value) => typeof value === "string" ? Infinity : value),
);
const commandHookTimeoutDesc =
  "Default timeout (ms) for all command hooks, can be overridden per command.\n" +
  "Use Infinity to never timeout (not recommended).\n";

const commandHookContinueOnErrorSchema = v.boolean();
const commandHookContinueOnErrorDesc =
  "Default behavior for all command hooks on error, can be overridden per command.\n";

const commandHookStdoutOverrideFormatSchema = v.enum(ConfigFileFormatsWithAuto);
const commandHookStdoutOverrideFormatDesc =
  "Default format for parsing stdout config override content.\n" +
  "Supported formats: json, jsonc, json5, yaml, toml, auto (best-effort detection).\n" +
  "Can be overridden per command. When overridden per command, only that command's stdout is checked for override markers.\n";

const commandHooksDesc =
  "Command hook configuration. Defines commands to run at key lifecycle points of the release process.";

export const CommandHooksSchema = v.object({
  timeout: v.pipe(
    v.optional(commandHookTimeoutSchema, 60 * 1000),
    v.metadata({
      description: commandHookTimeoutDesc + "Default: 60000 (1 min)",
    }),
  ),
  continueOnError: v.pipe(
    v.optional(commandHookContinueOnErrorSchema, false),
    v.metadata({
      description: commandHookContinueOnErrorDesc + "Default: false",
    }),
  ),
  stdoutOverrideFormat: v.pipe(
    v.optional(commandHookStdoutOverrideFormatSchema, "auto"),
    v.metadata({
      description: commandHookStdoutOverrideFormatDesc +
        'Default: "auto"',
    }),
  ),

  preRun: v.pipe(
    commandHookCommandsSchema,
    v.metadata({
      description:
        "Commands to run at the very start of the operation, before any actions are taken. Each command runs from the repository root.\n" +
        "Can be specified as a single command string, a configuration object (to configure `timeout`, `continueOnError`, and `stdoutOverrideFormat`), or an array of these.\n" +
        `Available variables that cmds can use: ${DOCS_EXT_REF_TOKEN}/docs/export-variables.md`,
    }),
  ),

  preCalculateVersion: v.pipe(
    commandHookCommandsSchema,
    v.metadata({
      description:
        "Commands to run after commits are parsed but before version calculation. Each command runs from the repository root.\n" +
        "Useful for printing a stdout config override to manipulate bump logic based on commit data.\n" +
        "Can be specified as a single command string, a configuration object (to configure `timeout`, `continueOnError`, and `stdoutOverrideFormat`), or an array of these.\n" +
        `Available variables that cmds can use: ${DOCS_EXT_REF_TOKEN}/docs/export-variables.md`,
    }),
  ),
  postCalculateVersion: v.pipe(
    commandHookCommandsSchema,
    v.metadata({
      description:
        "Commands to run after version is calculated but before files are modified. Each command runs from the repository root.\n" +
        "Useful for syncing external metadata using the newly resolved `nextVersion`.\n" +
        "Can be specified as a single command string, a configuration object (to configure `timeout`, `continueOnError`, and `stdoutOverrideFormat`), or an array of these.\n" +
        `Available variables that cmds can use: ${DOCS_EXT_REF_TOKEN}/docs/export-variables.md`,
    }),
  ),

  preCommit: v.pipe(
    commandHookCommandsSchema,
    v.metadata({
      description:
        "Commands to run after changelog and version files are written to disk, but before `git commit`. Each command runs from the repository root.\n" +
        "Useful for running formatters, linters, or custom replacements on the generated files before they enter git history.\n" +
        "Can be specified as a single command string, a configuration object (to configure `timeout`, `continueOnError`, and `stdoutOverrideFormat`), or an array of these.\n" +
        `Available variables that cmds can use: ${DOCS_EXT_REF_TOKEN}/docs/export-variables.md`,
    }),
  ),
  postCommit: v.pipe(
    commandHookCommandsSchema,
    v.metadata({
      description:
        "Commands to run after changes are committed and pushed. Each command runs from the repository root.\n" +
        "Can be specified as a single command string, a configuration object (to configure `timeout`, `continueOnError`, and `stdoutOverrideFormat`), or an array of these.\n" +
        `Available variables that cmds can use: ${DOCS_EXT_REF_TOKEN}/docs/export-variables.md`,
    }),
  ),
  postProposal: v.pipe(
    commandHookCommandsSchema,
    v.metadata({
      description:
        "Commands to run after the Release Proposal (PR, MR, ...) is created or updated. Each command runs from the repository root.\n" +
        "Useful for triggering downstream CI jobs or proposal review notifications.\n" +
        "Can be specified as a single command string, a configuration object (to configure `timeout`, `continueOnError`, and `stdoutOverrideFormat`), or an array of these.\n" +
        `Available variables that cmds can use: ${DOCS_EXT_REF_TOKEN}/docs/export-variables.md`,
    }),
  ),

  preTag: v.pipe(
    commandHookCommandsSchema,
    v.metadata({
      description:
        "Commands to run before the Git tag is created. Each command runs from the repository root.\n" +
        "Useful for final guardrails or external API sanity checks before cutting the permanent tag.\n" +
        "Can be specified as a single command string, a configuration object (to configure `timeout`, `continueOnError`, and `stdoutOverrideFormat`), or an array of these.\n" +
        `Available variables that cmds can use: ${DOCS_EXT_REF_TOKEN}/docs/export-variables.md`,
    }),
  ),
  preRelease: v.pipe(
    commandHookCommandsSchema,
    v.metadata({
      description:
        "Commands to run after the Git tag is created but before the platform release (GitHub Release, etc.). Each command runs from the repository root.\n" +
        "Useful for building/compiling binaries so they can be atomically attached during the release creation step.\n" +
        "Can be specified as a single command string, a configuration object (to configure `timeout`, `continueOnError`, and `stdoutOverrideFormat`), or an array of these.\n" +
        `Available variables that cmds can use: ${DOCS_EXT_REF_TOKEN}/docs/export-variables.md`,
    }),
  ),
  postRelease: v.pipe(
    commandHookCommandsSchema,
    v.metadata({
      description:
        "Commands to run after the platform release is fully live and assets are attached. Each command runs from the repository root.\n" +
        "Useful for announcements, webhooks, and publishing packages to external registries.\n" +
        "Can be specified as a single command string, a configuration object (to configure `timeout`, `continueOnError`, and `stdoutOverrideFormat`), or an array of these.\n" +
        `Available variables that cmds can use: ${DOCS_EXT_REF_TOKEN}/docs/export-variables.md`,
    }),
  ),

  postRun: v.pipe(
    commandHookCommandsSchema,
    v.metadata({
      description:
        "Commands to run after the main operation. Each command runs from the repository root.\n" +
        "These commands will always run regardless of operation outcome (success, skipped or failure). " +
        "It is recommended to check the outcome export variable if your script should only run under specific conditions.\n" +
        "Can be specified as a single command string, a configuration object (to configure `timeout`, `continueOnError`, and `stdoutOverrideFormat`), or an array of these.\n" +
        `Available variables that cmds can use: ${DOCS_EXT_REF_TOKEN}/docs/export-variables.md`,
    }),
  ),
});

type _CommandHooksInput = v.InferInput<typeof CommandHooksSchema>;
export type CommandHooksOutput = v.InferOutput<typeof CommandHooksSchema>;

export const CommandHooksPatchSchema = v.pipe(
  v.object(
    {
      timeout: v.pipe(
        v.optional(commandHookTimeoutSchema),
        v.metadata({
          description: commandHookTimeoutDesc + "Default: inherit from root",
        }),
      ),
      continueOnError: v.pipe(
        v.optional(commandHookContinueOnErrorSchema),
        v.metadata({
          description: commandHookContinueOnErrorDesc +
            "Default: inherit from root",
        }),
      ),
      stdoutOverrideFormat: v.pipe(
        v.optional(commandHookStdoutOverrideFormatSchema),
        v.metadata({
          description: commandHookStdoutOverrideFormatDesc +
            "Default: inherit from root",
        }),
      ),

      preRun: v.optional(v.unwrap(CommandHooksSchema.entries.preRun)),

      preCalculateVersion: v.optional(
        v.unwrap(CommandHooksSchema.entries.preCalculateVersion),
      ),
      postCalculateVersion: v.optional(
        v.unwrap(CommandHooksSchema.entries.postCalculateVersion),
      ),

      preCommit: v.optional(v.unwrap(CommandHooksSchema.entries.preCommit)),
      postCommit: v.optional(v.unwrap(CommandHooksSchema.entries.postCommit)),
      postProposal: v.optional(
        v.unwrap(CommandHooksSchema.entries.postProposal),
      ),

      preTag: v.optional(v.unwrap(CommandHooksSchema.entries.preTag)),
      preRelease: v.optional(v.unwrap(CommandHooksSchema.entries.preRelease)),
      postRelease: v.optional(v.unwrap(CommandHooksSchema.entries.postRelease)),

      postRun: v.optional(v.unwrap(CommandHooksSchema.entries.postRun)),
    } satisfies Record<keyof CommandHooksOutput, unknown>,
  ),
  v.metadata({
    description: commandHooksDesc,
  }),
);

export type CommandHookKind = Exclude<
  keyof CommandHooksOutput,
  "timeout" | "continueOnError" | "stdoutOverrideFormat"
>;

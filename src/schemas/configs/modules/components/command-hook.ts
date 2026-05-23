import * as v from "@valibot/valibot";
import { DOCS_EXT_REF_TOKEN } from "../../../token.ts";
import { CommandSchema } from "./command.ts";

export const commandHookCommandsSchema = v.pipe(
  v.optional(
    v.union([CommandSchema, v.pipe(v.array(CommandSchema), v.nonEmpty())]),
  ),
  v.transform((input) => {
    if (input !== undefined) return Array.isArray(input) ? input : [input];
    return input;
  }),
);

type _CommandHookCommandsInput = v.InferInput<typeof commandHookCommandsSchema>;
type _CommandHookCommandsOutput = v.InferOutput<typeof commandHookCommandsSchema>;

export const CommandHooksSchema = v.object({
  timeout: v.pipe(
    v.optional(
      v.pipe(
        v.union([
          v.pipe(v.number(), v.minValue(1), v.safeInteger()),
          v.literal(Infinity),
          v.literal("Infinity"),
          v.literal("infinity"),
        ]),
        v.transform((value) => typeof value === "string" ? Infinity : value),
      ),
      60 * 1000,
    ),
    v.metadata({
      description:
        "Default timeout (ms) for all command hooks, can be overridden per command.\n" +
        "Use Infinity to never timeout (not recommended).\n" +
        "Default: 60000 (1 min)",
    }),
  ),
  continueOnError: v.pipe(
    v.optional(v.boolean(), false),
    v.metadata({
      description:
        "Default behavior for all command hooks on error, can be overridden per command.\n" +
        "Default: false",
    }),
  ),

  preRun: v.pipe(
    commandHookCommandsSchema,
    v.metadata({
      description:
        "Commands to run before the main operation. Each command runs from the repository root.\n" +
        "Can be specified as a single command string, a configuration object (to configure `timeout` and `continueOnError`), or an array of these.\n" +
        `Available variables that cmds can use: ${DOCS_EXT_REF_TOKEN}/docs/export-variables.md`,
    }),
  ),

  prePrepare: v.pipe(
    commandHookCommandsSchema,
    v.metadata({
      description:
        "Commands to run before the proposal (PR, MR, ...) phase. Each command runs from the repository root.\n" +
        "Can be specified as a single command string, a configuration object (to configure `timeout` and `continueOnError`), or an array of these.\n" +
        `Available variables that cmds can use: ${DOCS_EXT_REF_TOKEN}/docs/export-variables.md`,
    }),
  ),
  postPrepare: v.pipe(
    commandHookCommandsSchema,
    v.metadata({
      description:
        "Commands to run after the proposal (PR, MR, ...) phase. Each command runs from the repository root.\n" +
        "Can be specified as a single command string, a configuration object (to configure `timeout` and `continueOnError`), or an array of these.\n" +
        `Available variables that cmds can use: ${DOCS_EXT_REF_TOKEN}/docs/export-variables.md`,
    }),
  ),

  prePublish: v.pipe(
    commandHookCommandsSchema,
    v.metadata({
      description:
        "Commands to run before the release phase. Each command runs from the repository root.\n" +
        "Can be specified as a single command string, a configuration object (to configure `timeout` and `continueOnError`), or an array of these.\n" +
        `Available variables that cmds can use: ${DOCS_EXT_REF_TOKEN}/docs/export-variables.md`,
    }),
  ),
  postPublish: v.pipe(
    commandHookCommandsSchema,
    v.metadata({
      description:
        "Commands to run after the release phase. Each command runs from the repository root.\n" +
        "Can be specified as a single command string, a configuration object (to configure `timeout` and `continueOnError`), or an array of these.\n" +
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
        "Can be specified as a single command string, a configuration object (to configure `timeout` and `continueOnError`), or an array of these.\n" +
        `Available variables that cmds can use: ${DOCS_EXT_REF_TOKEN}/docs/export-variables.md`,
    }),
  ),
});

type _CommandHooksInput = v.InferInput<typeof CommandHooksSchema>;
export type CommandHooksOutput = v.InferOutput<typeof CommandHooksSchema>;

export type CommandHookKind = Exclude<
  keyof CommandHooksOutput,
  "timeout" | "continueOnError"
>;

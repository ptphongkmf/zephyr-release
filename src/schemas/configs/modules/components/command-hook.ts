import * as v from "@valibot/valibot";
import { DOCS_EXT_REF_TOKEN } from "../../../token.ts";
import { CommandSchema } from "./command.ts";

export const CommandHookSchema = v.object({
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
        "Base default timeout (ms) for all commands in `pre` and `post`, can be overridden per command.\n" +
        "Use Infinity to never timeout (not recommended).\n" +
        "Default: 60000 (1 min)",
    }),
  ),
  continueOnError: v.pipe(
    v.optional(v.boolean(), false),
    v.metadata({
      description:
        "Base default behavior for all commands in `pre` and `post`, can be overridden per command.\n" +
        "Default: false",
    }),
  ),

  pre: v.pipe(
    v.optional(
      v.union([CommandSchema, v.pipe(v.array(CommandSchema), v.nonEmpty())]),
    ),
    v.transform((input) => {
      if (input !== undefined) return Array.isArray(input) ? input : [input];
      return input;
    }),
    v.metadata({
      description: "Commands to run before the operation.\n" +
        "Can be specified as a single command string, a configuration object (to configure `timeout` and `continueOnError`), or an array of these.\n" +
        `List of exposed env variables: ${DOCS_EXT_REF_TOKEN}/docs/export-variables.md`,
    }),
  ),
  post: v.pipe(
    v.optional(
      v.union([CommandSchema, v.pipe(v.array(CommandSchema), v.nonEmpty())]),
    ),
    v.transform((input) => {
      if (input !== undefined) return Array.isArray(input) ? input : [input];
      return input;
    }),
    v.metadata({
      description: "Commands to run after the operation.\n" +
        "Can be specified as a single command string, a configuration object (to configure `timeout` and `continueOnError`), or an array of these.\n" +
        `List of exposed env variables: ${DOCS_EXT_REF_TOKEN}/docs/export-variables.md`,
    }),
  ),
});

type _CommandHookInput = v.InferInput<typeof CommandHookSchema>;
export type CommandHookOutput = v.InferOutput<typeof CommandHookSchema>;

export type CommandHookKind = Exclude<
  keyof CommandHookOutput,
  "timeout" | "continueOnError"
>;

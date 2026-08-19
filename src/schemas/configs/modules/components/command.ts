import * as v from "@valibot/valibot";
import { trimNonEmptyStringSchema } from "../../../string.ts";
import { ConfigFileFormatsWithAuto } from "../../../../constants/file-formats.ts";

export const CommandSchema = v.pipe(
  v.union([
    trimNonEmptyStringSchema,

    v.object({
      cmd: trimNonEmptyStringSchema,
      timeout: v.pipe(
        v.optional(
          v.pipe(
            v.union([
              v.pipe(v.number(), v.minValue(1), v.safeInteger()),
              v.literal(Infinity),
              v.literal("Infinity"),
              v.literal("infinity"),
            ]),
            v.transform((value) =>
              typeof value === "string" ? Infinity : value
            ),
          ),
        ),
        v.metadata({
          description:
            "Timeout in milliseconds, use Infinity to never timeout (not recommended).\n" +
            "Defaults to `commandHooks` root `timeout` value",
        }),
      ),
      continueOnError: v.pipe(
        v.optional(v.boolean()),
        v.metadata({
          description: "Continue or stop the process on commands error.\n" +
            "Defaults to `commandHooks` root `continueOnError` value",
        }),
      ),
      stdoutOverrideFormat: v.pipe(
        v.optional(v.enum(ConfigFileFormatsWithAuto)),
        v.metadata({
          description:
            "Format to parse stdout config override content for this specific command.\n" +
            "Overrides the `commandHooks` root `stdoutOverrideFormat` value.\n" +
            "If set, only the stdout from this command (not the combined output) is checked for override markers.\n" +
            "Defaults to `commandHooks` root `stdoutOverrideFormat` value",
        }),
      ),
    }),
  ]),
  v.transform((input) => typeof input === "string" ? { cmd: input } : input),
);

type _CommandInput = v.InferInput<typeof CommandSchema>;
export type CommandOutput = v.InferOutput<typeof CommandSchema>;

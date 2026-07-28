import * as v from "@valibot/valibot";
import { trimNonEmptyStringSchema } from "../../../string.ts";
import { ConfigFileFormatsWithAuto } from "../../../../constants/file-formats.ts";

export const RuntimeConfigOverrideSchema = v.object({
  path: v.pipe(
    trimNonEmptyStringSchema,
    v.metadata({
      description:
        "Path to a JSON/YAML/TOML file containing runtime config overrides.\n" +
        "This path is always relative to the repository root, even in monorepo mode.\n" +
        "This is a global-only setting and is not available in workspace member configs.",
    }),
  ),
  format: v.pipe(
    v.optional(v.enum(ConfigFileFormatsWithAuto), "auto"),
    v.metadata({
      description:
        'The format of the runtime config override file.\n' +
        'Default: "auto"',
    }),
  ),
});

type _RuntimeConfigOverrideInput = v.InferInput<
  typeof RuntimeConfigOverrideSchema
>;
export type RuntimeConfigOverrideOutput = v.InferOutput<
  typeof RuntimeConfigOverrideSchema
>;

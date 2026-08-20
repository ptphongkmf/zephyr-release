import * as v from "@valibot/valibot";
import { SourceModeOptions } from "../../constants/source-mode-options.ts";
import { trimNonEmptyStringSchema } from "../string.ts";

export const SourceModeSchema = v.object({
  mode: v.optional(v.enum(SourceModeOptions), "remote"),

  overrides: v.optional(
    v.record(trimNonEmptyStringSchema, v.enum(SourceModeOptions)),
    {},
  ),
});

type _SourceModeInput = v.InferInput<typeof SourceModeSchema>;
export type SourceModeOutput = v.InferOutput<typeof SourceModeSchema>;

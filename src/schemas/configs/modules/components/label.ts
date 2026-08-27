import * as v from "@valibot/valibot";
import { trimNonEmptyStringSchema } from "../../../string.ts";

const LabelSchema = v.object({
  name: trimNonEmptyStringSchema,
  description: v.optional(v.pipe(v.string(), v.trim())),
  color: v.pipe(
    v.optional(v.pipe(trimNonEmptyStringSchema, v.hexColor()), "#ededed"),
    v.metadata({
      description:
        "The hexadecimal color code for the label, in standard format with the leading #.\n" +
        'Default: "#ededed"',
    }),
  ),
  createIfMissing: v.optional(v.boolean(), false),
});

type _LabelInput = v.InferInput<typeof LabelSchema>;
type _LabelOutput = v.InferOutput<typeof LabelSchema>;

export const LabelItemSchema = v.pipe(
  v.union([trimNonEmptyStringSchema, LabelSchema]),
  v.transform((input) =>
    typeof input === "string"
      ? {
        name: input,
        color: LabelSchema.entries.color.default,
        createIfMissing: LabelSchema.entries.createIfMissing.default,
      }
      : input
  ),
);

type _LabelItemInput = v.InferInput<typeof LabelItemSchema>;
export type LabelItemOutput = v.InferOutput<typeof LabelItemSchema>;

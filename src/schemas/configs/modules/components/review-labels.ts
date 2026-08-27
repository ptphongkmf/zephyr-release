import * as v from "@valibot/valibot";
import { LabelItemSchema } from "./label.ts";
import { LabelOnMergeRemoveOptions } from "../../../../constants/label-options.ts";

export const ReviewLabelsSchema = v.object({
  onCreate: v.pipe(
    v.optional(
      v.union([
        LabelItemSchema,
        v.pipe(v.array(LabelItemSchema), v.nonEmpty()),
      ]),
    ),
    v.transform((input) => {
      if (input !== undefined) return Array.isArray(input) ? input : [input];
      return input;
    }),
    v.metadata({
      description:
        "Labels to attach to proposals when created. Can be a string, a label object, " +
        "or an array containing either.",
    }),
  ),

  onMerge: v.pipe(
    v.optional(
      v.object({
        add: v.pipe(
          v.optional(
            v.union([
              LabelItemSchema,
              v.pipe(v.array(LabelItemSchema), v.nonEmpty()),
            ]),
          ),
          v.transform((input) => {
            if (input !== undefined) {
              return Array.isArray(input) ? input : [input];
            }
            return input;
          }),
        ),
        remove: v.pipe(
          v.optional(
            v.union([
              LabelItemSchema,
              v.pipe(v.array(LabelItemSchema), v.nonEmpty()),
            ]),
          ),
          v.transform((input) => {
            if (input !== undefined) {
              return Array.isArray(input) ? input : [input];
            }
            return input;
          }),
          v.metadata({
            description: `Use "${LabelOnMergeRemoveOptions.allOnCreate}" ` +
              "to remove all labels added in `onCreate`.",
          }),
        ),
      }),
    ),
    v.metadata({
      description:
        "Labels to attach and remove from proposals when merged. Can be a string, a label object, " +
        "or an array containing either.\n" +
        `For remove, you can use "${LabelOnMergeRemoveOptions.allOnCreate}" ` +
        "to remove all labels added in `onCreate`.",
    }),
  ),
});

type _ReviewLabelsInput = v.InferInput<typeof ReviewLabelsSchema>;
type _ReviewLabelsOutput = v.InferOutput<typeof ReviewLabelsSchema>;

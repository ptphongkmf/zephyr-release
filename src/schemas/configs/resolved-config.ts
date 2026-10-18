import * as v from "@valibot/valibot";
import {
  type WorkspaceMemberConfigOutput,
  WorkspaceMemberConfigSchema,
} from "./workspace-member-config.ts";
import { ReviewConfigResolvedSchema } from "./modules/review-config.ts";
import { type BaseConfigOutput, BaseConfigSchema } from "./base-config.ts";

export const ResolvedConfigSchema = v.pipe(
  v.strictObject(
    {
      ...BaseConfigSchema.entries,

      title: WorkspaceMemberConfigSchema.entries.title,

      review: v.optional(ReviewConfigResolvedSchema, {}),
    } satisfies Record<
      keyof BaseConfigOutput | keyof WorkspaceMemberConfigOutput,
      unknown
    >,
  ),
  v.transform((input) => ({
    ...input,
    title: input.title || input.name || "root",
  })),
);

export type ResolvedConfig = v.InferOutput<typeof ResolvedConfigSchema>;

import * as v from "@valibot/valibot";
import type { AutoStrategyType } from "../../../../constants/auto-release-strategy-types.ts";
import { trimNonEmptyStringSchema } from "../../../string.ts";

function AutoStrategyTypeSchema<T extends AutoStrategyType>(
  type: T,
  description: string,
) {
  return v.pipe(
    v.literal(type),
    v.metadata({
      description,
    }),
  );
}

export const AutoStrategySchema = v.variant("type", [
  v.object({
    type: AutoStrategyTypeSchema(
      "commit-types",
      "Triggers a release automatically when the pushed commits contain specific allowed types.",
    ),
    allowedTypes: v.pipe(
      v.optional(
        v.union([
          trimNonEmptyStringSchema,
          v.pipe(v.array(trimNonEmptyStringSchema), v.nonEmpty()),
        ]),
      ),
      v.transform((input) => {
        if (input !== undefined) return Array.isArray(input) ? input : [input];
        return input;
      }),
      v.metadata({
        description:
          "Allowed commit types (a string or array of strings) that can trigger a release, must be chosen from the base " +
          "`commitTypes`. If omitted, all types in the base `commitTypes` are allowed.",
      }),
    ),
    minCommitCount: v.pipe(
      v.optional(
        v.union([v.number(), v.record(trimNonEmptyStringSchema, v.number())]),
        1,
      ),
      v.metadata({
        description:
          "The minimum number of unreleased matching commits required to trigger a release. " +
          "Accepts a single number for a global count, or an object mapping specific commit types to their own minimum counts.\n" +
          "When using object, thresholds are evaluated using OR logic, the release triggers if ANY of the specified counts " +
          "are met.\n" +
          "Default: 1",
        examples: [5, { feat: 1, fix: 5 }],
      }),
    ),
    requireBreaking: v.pipe(
      v.optional(v.boolean(), false),
      v.metadata({
        description:
          "If set to true, an auto-release will ONLY trigger if at least one of the matching commits contains a breaking change.\n" +
          "Default: false",
      }),
    ),
  }),

  v.object({
    type: AutoStrategyTypeSchema(
      "commit-footer",
      "Triggers a release automatically when a specific token is found in the commit footers.",
    ),
    token: v.pipe(
      trimNonEmptyStringSchema,
      v.metadata({
        description:
          'The conventional commit footer token to look for (e.g., "Autorelease").',
      }),
    ),
    value: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          'The specific value the footer token must have (e.g., "true"). If omitted, only the token presence is required.',
      }),
    ),
  }),

  v.object({
    type: AutoStrategyTypeSchema(
      "flag",
      "Triggers a release based on a strict boolean flag. Ideal for dynamic configuration overrides and custom script evaluations.\n" +
        "The strategy will be evaluated after the cmd hooks `preRun` and `prePrepare` run.",
    ),
    value: v.pipe(
      v.optional(v.boolean(), false),
      v.metadata({
        description:
          "A hardcoded boolean flag to explicitly force or skip the release trigger.",
      }),
    ),
  }),
]);

type _AutoStrategyInput = v.InferInput<typeof AutoStrategySchema>;
type _AutoStrategyOutput = v.InferOutput<typeof AutoStrategySchema>;

import * as v from "@valibot/valibot";
import { countBreakingAsOptions } from "../../../../constants/bump-rules.ts";
import { trimNonEmptyStringSchema } from "../../../string.ts";

const countBreakingAsSchema = v.enum(countBreakingAsOptions);
const countBreakingAsDesc =
  "Count a breaking change as none, or one commit, or one bump directly regardless of current chosen `types`, as long as " +
  "the commit type exists in base `commitTypes` list.\n";

const commitsPerBumpSchema = v.pipe(
  v.union([
    v.pipe(v.number(), v.minValue(1), v.safeInteger()),
    v.literal(Infinity),
    v.literal("Infinity"),
    v.literal("infinity"),
  ]),
  v.transform((value) => typeof value === "string" ? Infinity : value),
);
const commitsPerBumpDesc =
  "Number of commits required for additional version bump after the first. Use Infinity to always bump once, unless " +
  '`countBreakingAs` is set to "bump".\n';

export const BumpRuleCoreSchema = v.object({
  types: v.pipe(
    v.optional(
      v.pipe(v.array(trimNonEmptyStringSchema), v.nonEmpty()),
    ),
    v.metadata({
      description:
        "Commit types that count toward version bumping, must be picked from the base `commitTypes` list.",
    }),
  ),
  countBreakingAs: v.pipe(
    v.optional(countBreakingAsSchema, "commit"),
    v.metadata({
      description: countBreakingAsDesc + 'Default: "commit"',
    }),
  ),
  commitsPerBump: v.pipe(
    v.optional(commitsPerBumpSchema, Infinity),
    v.metadata({
      description: commitsPerBumpDesc + "Default: Infinity",
    }),
  ),
});

export type BumpRuleInput = v.InferInput<typeof BumpRuleCoreSchema>;
export type BumpRuleOutput = v.InferOutput<typeof BumpRuleCoreSchema>;

export const BumpRuleCorePatchSchema = v.object(
  {
    types: BumpRuleCoreSchema.entries.types,
    countBreakingAs: v.pipe(
      v.optional(countBreakingAsSchema),
      v.metadata({
        description: countBreakingAsDesc + "Default: inherit from root",
      }),
    ),
    commitsPerBump: v.pipe(
      v.optional(commitsPerBumpSchema),
      v.metadata({
        description: commitsPerBumpDesc + "Default: inherit from root",
      }),
    ),
  } satisfies Record<keyof BumpRuleOutput, unknown>,
);

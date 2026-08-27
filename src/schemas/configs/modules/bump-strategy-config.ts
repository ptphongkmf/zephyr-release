import * as v from "@valibot/valibot";
import {
  BumpRuleCorePatchSchema,
  BumpRuleCoreSchema,
} from "./components/bump-rule-core.ts";
import {
  BumpRuleExtensionPatchSchema,
  BumpRuleExtensionSchema,
} from "./components/bump-rule-extension.ts";
import {
  DEFAULT_MAJOR_BUMP_STRATEGY,
  DEFAULT_MINOR_BUMP_STRATEGY,
  DEFAULT_PATCH_BUMP_STRATEGY,
} from "../../../constants/defaults/bump-strategy.ts";
import { transformObjKeyToKebabCase } from "../../../utils/transformers/object.ts";

const treatMajorAsMinorPreStableSchema = v.boolean();
const treatMajorAsMinorPreStableDesc =
  "Treats major changes as minor version bumps in pre-1.0 (0.x.x) releases.\n";

const treatMinorAsPatchPreStableSchema = v.boolean();
const treatMinorAsPatchPreStableDesc =
  "Treats minor changes as patch version bumps in pre-1.0 (0.x.x) releases.\n";

const majorVersionDesc = "Strategy for bumping major version (x.2.3).\n";
const minorVersionDesc = "Strategy for bumping minor version (1.x.3).\n";
const patchVersionDesc = "Strategy for bumping patch version (1.2.x).\n";

const bumpStrategyConfigDesc =
  "Configuration options to calculate the next version number.";

export const BumpStrategyConfigSchema = v.pipe(
  v.object({
    treatMajorAsMinorPreStable: v.pipe(
      v.optional(treatMajorAsMinorPreStableSchema, true),
      v.metadata({
        description: treatMajorAsMinorPreStableDesc + "Default: true",
      }),
    ),
    treatMinorAsPatchPreStable: v.pipe(
      v.optional(treatMinorAsPatchPreStableSchema, true),
      v.metadata({
        description: treatMinorAsPatchPreStableDesc + "Default: true",
      }),
    ),

    major: v.pipe(
      v.optional(BumpRuleCoreSchema, DEFAULT_MAJOR_BUMP_STRATEGY),
      v.metadata({
        description: majorVersionDesc +
          `Default: ${
            JSON.stringify(
              transformObjKeyToKebabCase(DEFAULT_MAJOR_BUMP_STRATEGY),
              null,
              2,
            )
          }`,
      }),
    ),
    minor: v.pipe(
      v.optional(BumpRuleCoreSchema, DEFAULT_MINOR_BUMP_STRATEGY),
      v.metadata({
        description: minorVersionDesc +
          `Default: ${
            JSON.stringify(
              transformObjKeyToKebabCase(DEFAULT_MINOR_BUMP_STRATEGY),
              null,
              2,
            )
          }`,
      }),
    ),
    patch: v.pipe(
      v.optional(BumpRuleCoreSchema, DEFAULT_PATCH_BUMP_STRATEGY),
      v.metadata({
        description: patchVersionDesc +
          `Default: ${
            JSON.stringify(
              transformObjKeyToKebabCase(DEFAULT_PATCH_BUMP_STRATEGY),
              null,
              2,
            )
          }`,
      }),
    ),

    prerelease: v.pipe(
      v.optional(BumpRuleExtensionSchema, {}),
      v.metadata({
        description: "Strategy for bumping prerelease version (1.2.3-x.x).",
      }),
    ),
    build: v.pipe(
      v.optional(BumpRuleExtensionSchema, {}),
      v.metadata({
        description: "Strategy for bumping build metadata (1.2.3+x.x).",
      }),
    ),
  }),
  v.metadata({
    description: bumpStrategyConfigDesc,
  }),
);

type _BumpStrategyConfigInput = v.InferInput<typeof BumpStrategyConfigSchema>;
export type BumpStrategyConfigOutput = v.InferOutput<
  typeof BumpStrategyConfigSchema
>;

export const BumpStrategyConfigPatchSchema = v.pipe(
  v.object(
    {
      treatMajorAsMinorPreStable: v.pipe(
        v.optional(treatMajorAsMinorPreStableSchema),
        v.metadata({
          description: treatMajorAsMinorPreStableDesc +
            "Default: inherit from root",
        }),
      ),
      treatMinorAsPatchPreStable: v.pipe(
        v.optional(treatMinorAsPatchPreStableSchema),
        v.metadata({
          description: treatMinorAsPatchPreStableDesc +
            "Default: inherit from root",
        }),
      ),

      major: v.pipe(
        v.optional(BumpRuleCorePatchSchema),
        v.metadata({
          description: majorVersionDesc + "Default: inherit from root",
        }),
      ),
      minor: v.pipe(
        v.optional(BumpRuleCorePatchSchema),
        v.metadata({
          description: minorVersionDesc + "Default: inherit from root",
        }),
      ),
      patch: v.pipe(
        v.optional(BumpRuleCorePatchSchema),
        v.metadata({
          description: patchVersionDesc + "Default: inherit from root",
        }),
      ),

      prerelease: v.optional(
        v.unwrap(BumpStrategyConfigSchema.entries.prerelease),
      ),
      build: v.optional(
        v.unwrap(BumpStrategyConfigSchema.entries.build),
      ),
    } satisfies Record<keyof BumpStrategyConfigOutput, unknown>,
  ),
  v.metadata({
    description: bumpStrategyConfigDesc,
  }),
);

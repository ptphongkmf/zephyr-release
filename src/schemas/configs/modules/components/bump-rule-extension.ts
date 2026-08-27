import * as v from "@valibot/valibot";
import { SemverExtensionSchema } from "./semver-extension.ts";
import { trimNonEmptyStringSchema } from "../../../string.ts";

const extensionEnabledSchema = v.boolean();
const extensionEnabledDesc =
  "Enable/disable handling of SemVer extensions (pre-release identifiers / build metadata).\n";

const treatOverrideAsSignificantSchema = v.boolean();
const treatOverrideAsSignificantDesc =
  "If set to `true`, the presence of an `override` is strictly treated as a structural change.\n" +
  "This immediately triggers resets on any dependent version components (e.g., resetting the Build number)\n" +
  "If `false`, overrides are treated as volatile/dynamic and ignored by reset logic.\n";

export const BumpRuleExtensionSchema = v.object({
  enabled: v.pipe(
    v.optional(extensionEnabledSchema, false),
    v.metadata({
      description: extensionEnabledDesc + "Default: false",
    }),
  ),

  override: v.pipe(
    v.optional(
      v.pipe(
        v.array(
          v.union([trimNonEmptyStringSchema, v.number()]),
        ),
        v.nonEmpty(),
      ),
    ),
    v.transform((input) =>
      typeof input === "undefined" ? input : input.map(String)
    ),
    v.metadata({
      description:
        "Overrides extension items to use for the next version. When provided, these values take precedence over " +
        "all other bump rules in `extensions`. Should only be set dynamically, not in static config.",
    }),
  ),
  treatOverrideAsSignificant: v.pipe(
    v.optional(treatOverrideAsSignificantSchema, false),
    v.metadata({
      description: treatOverrideAsSignificantDesc + "Default: false",
    }),
  ),

  extensions: v.pipe(
    v.optional(v.pipe(v.array(SemverExtensionSchema), v.nonEmpty())),
    v.metadata({
      description: "Specifies the items to use for SemVer extensions.",
    }),
  ),
});

type _BumpRuleExtensionInput = v.InferInput<typeof BumpRuleExtensionSchema>;
export type BumpRuleExtensionOutput = v.InferOutput<
  typeof BumpRuleExtensionSchema
>;

export const BumpRuleExtensionPatchSchema = v.object(
  {
    enabled: v.pipe(
      v.optional(extensionEnabledSchema),
      v.metadata({
        description: extensionEnabledDesc + "Default: inherit from root",
      }),
    ),

    override: BumpRuleExtensionSchema.entries.override,
    treatOverrideAsSignificant: v.pipe(
      v.optional(treatOverrideAsSignificantSchema),
      v.metadata({
        description: treatOverrideAsSignificantDesc +
          "Default: inherit from root",
      }),
    ),

    extensions: BumpRuleExtensionSchema.entries.extensions,
  } satisfies Record<keyof BumpRuleExtensionOutput, unknown>,
);

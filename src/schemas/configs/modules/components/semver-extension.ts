import * as v from "@valibot/valibot";
import { TimeZoneSchema } from "./timezone.ts";
import {
  SemverExtensionDateFormatTypes,
  SemverExtensionResetOnOptions,
  SemverExtensionTimestampUnitTypes,
  type SemverExtensionType,
} from "../../../../constants/semver-extension-options.ts";
import { trimNonEmptyStringSchema } from "../../../string.ts";

function SemverExtensionTypeSchema<T extends SemverExtensionType>(
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

export const SemverExtensionSchema = v.variant("type", [
  v.object({
    type: SemverExtensionTypeSchema(
      "static",
      'A stable label that should not change often. Examples: "alpha", "beta", "rc".',
    ),
    value: v.pipe(
      trimNonEmptyStringSchema,
      v.metadata({
        description: "The static string value to use.",
        examples: ["pre", "alpha", "beta", "rc"],
      }),
    ),
  }),

  v.object({
    type: SemverExtensionTypeSchema(
      "dynamic",
      "A label value that often changes per build or commit, usually sourced externally (e.g., git hash, branch name).",
    ),
    value: v.pipe(
      v.optional(v.pipe(v.string(), v.trim())),
      v.metadata({
        description: "The string value to use, should be set dynamically.",
      }),
    ),
    fallbackValue: v.pipe(
      v.optional(v.pipe(v.string(), v.trim())),
      v.metadata({
        description:
          "The fallback string value used when `value` is empty. If this is also empty, the identifier/metadata " +
          "will be omitted from the array.",
      }),
    ),
  }),

  v.object({
    type: SemverExtensionTypeSchema(
      "incremental",
      "Integer value that auto-increments by 1.",
    ),
    initialValue: v.pipe(
      v.optional(v.pipe(v.number(), v.safeInteger()), 0),
      v.metadata({
        description:
          "Initial integer number value, will auto-increment by 1 on each bump.\n" +
          "Default: 0",
      }),
    ),
    resetOn: v.pipe(
      v.optional(
        v.union([
          v.enum(SemverExtensionResetOnOptions),
          v.pipe(v.array(v.enum(SemverExtensionResetOnOptions)), v.nonEmpty()),
        ]),
        "none",
      ),
      v.transform((input) => Array.isArray(input) ? input : [input]),
      v.metadata({
        description:
          "Resets the incremental value when the specified version component(s) change, could be a single or an array of options. " +
          'Allowed values: "major", "minor", "patch", "prerelease", "build", and "none".\n' +
          'For "prerelease" and "build", a reset is triggered only when "static" values change, ' +
          'or when "static", "incremental", "timestamp" or "date" are added or removed. ' +
          'Any changes to "dynamic" values, including their addition or removal, do not trigger a reset.\n' +
          'Default: "none"',
      }),
    ),
  }),

  v.object({
    type: SemverExtensionTypeSchema(
      "timestamp",
      "Integer value that changes over time, representing a specific point in time since January 1, 1970 (UTC).",
    ),
    unit: v.pipe(
      v.optional(v.enum(SemverExtensionTimestampUnitTypes), "ms"),
      v.metadata({
        description: 'The time unit. "ms" (13 digits) or "s" (10 digits).\n' +
          'Default: "ms"',
      }),
    ),
  }),

  v.object({
    type: SemverExtensionTypeSchema(
      "date",
      "A date string that changes over time.",
    ),
    format: v.pipe(
      v.optional(v.enum(SemverExtensionDateFormatTypes), "YYYYMMDD"),
      v.metadata({
        description: 'The date format. "YYYYMMDD" or "YYYY-MM-DD".\n' +
          'Default: "YYYYMMDD"',
      }),
    ),
    timeZone: v.pipe(
      v.optional(TimeZoneSchema),
      v.metadata({
        description:
          "The timezone to use for the date. If not specified, falls back to base `timeZone`.",
      }),
    ),
  }),
]);

type _SemverExtensionInput = v.InferInput<
  typeof SemverExtensionSchema
>;
export type SemverExtensionOutput = v.InferOutput<
  typeof SemverExtensionSchema
>;

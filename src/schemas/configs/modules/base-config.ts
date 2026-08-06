import * as v from "@valibot/valibot";
import { DOCS_EXT_REF_TOKEN } from "../../token.ts";
import { TimeZoneSchema } from "./components/timezone.ts";
import { CommitTypeSchema } from "./components/commit-type.ts";
import { VersionFileSchema } from "./components/version-file.ts";
import { CommandHooksSchema } from "./components/command-hook.ts";
import { SEMVER_REGEX } from "../../../constants/semver.ts";
import { DEFAULT_COMMIT_TYPES } from "../../../constants/defaults/commit.ts";
import { transformObjKeyToKebabCase } from "../../../utils/transformers/object.ts";
import { trimNonEmptyStringSchema } from "../../string.ts";
import { ReleaseFlows } from "../../../constants/release-flows.ts";
import { ReviewConfigSchema } from "./review-config.ts";
import { AutoConfigSchema } from "./auto-config.ts";

export const BaseCoreConfigSchema = v.object({
  name: v.pipe(
    v.optional(v.pipe(v.string(), v.trim())),
    v.metadata({
      description: "Project name, available in string templates as {{ name }}.",
    }),
  ),
  timeZone: v.pipe(
    v.optional(TimeZoneSchema, "UTC"),
    v.metadata({
      description:
        "IANA timezone used to display times, available in string templates as {{ timeZone }}.\n" +
        'Default: "UTC"',
    }),
  ),
  customStringPatterns: v.pipe(
    v.optional(
      v.record(trimNonEmptyStringSchema, v.unknown()),
    ),
    v.metadata({
      description:
        "Custom string patterns to use in templates. The key is the pattern, available as '{{ <key> }}' while " +
        "the resolved value is the key value.",
    }),
  ),

  releaseFlow: v.pipe(
    v.optional(v.enum(ReleaseFlows), "review"),
    v.metadata({
      description: "Defines the release flow:\n" +
        '- "review": routes updates through a proposal (PR, MR, ...).\n' +
        '- "auto": bypasses the proposal and commits directly to the branch.\n' +
        'If choosing "auto", see `auto.triggerStrategy`.\n' +
        'Default: "review"',
    }),
  ),
  review: v.optional(ReviewConfigSchema, {}),
  auto: v.optional(AutoConfigSchema, {}),

  initialVersion: v.pipe(
    v.optional(v.pipe(v.string(), v.regex(SEMVER_REGEX)), "0.1.0"),
    v.metadata({
      description:
        "Initial SemVer version used when no existing version is found or the existing one is `0.0.0`.\n" +
        "You can still set this to `0.0.0` if you want it as the starting value; looping problems are handled automatically under the hood.\n" +
        'Default: "0.1.0"',
    }),
  ),
  versionFiles: v.pipe(
    v.union([
      VersionFileSchema,
      v.pipe(v.array(VersionFileSchema), v.nonEmpty()),
    ]),
    v.transform((input) => Array.isArray(input) ? input : [input]),
    v.metadata({
      description:
        "Version file(s). Accepts a single file object or an array of file objects. If a single object, it becomes the " +
        "primary file. If arrays, the first file with `primary: true` becomes the primary; if none are marked, " +
        "the first file in the array will be used.\n" +
        `About primary file: ${DOCS_EXT_REF_TOKEN}/docs/config-options.md#version-files-required`,
    }),
  ),

  commitTypes: v.pipe(
    v.optional(
      v.pipe(v.array(CommitTypeSchema), v.nonEmpty()),
      DEFAULT_COMMIT_TYPES,
    ),
    v.metadata({
      description:
        "List of commit types used for version calculation and changelog generation.\n" +
        `Default: ${
          JSON.stringify(
            transformObjKeyToKebabCase(DEFAULT_COMMIT_TYPES),
            null,
            2,
          )
        }`,
    }),
  ),
  maxCommitsToResolve: v.pipe(
    v.optional(v.number(), 100),
    v.metadata({
      description:
        "The maximum number of commits allowed to resolve, the rest will be truncated.\n" +
        "Default: 100",
    }),
  ),
  resolveUntilCommitHash: v.pipe(
    v.optional(trimNonEmptyStringSchema),
    v.metadata({
      description:
        "Forces the tool to keep resolving commits until it reaches this specific hash, completely bypassing the " +
        "standard resolve behavior.\n" +
        "This still respects the `maxCommitsToResolve` safety limit.\n" +
        "Avoid hardcoding this in your static config file, set it dynamically.",
    }),
  ),
  allowedReleaseAsCommitTypes: v.pipe(
    v.optional(
      v.union([
        trimNonEmptyStringSchema,
        v.pipe(v.array(trimNonEmptyStringSchema), v.nonEmpty()),
      ]),
      "<ALL>",
    ),
    v.transform((input) => Array.isArray(input) ? input : [input]),
    v.metadata({
      description:
        "List of commit type(s) allowed to trigger 'release-as'. Accepts single or array of strings.\n" +
        'Use "<ALL>" to accept any commit type; use "<COMMIT_TYPES>" to use the list defined in `commitTypes`. You can combine "<COMMIT_TYPES>" with other types (for example: ["<COMMIT_TYPES>","docs"]).\n' +
        `About 'release-as': ${DOCS_EXT_REF_TOKEN}?tab=readme-ov-file#force-a-specific-version \n` +
        'Default: "<ALL>"',
      examples: ["<COMMIT_TYPES>", ["<COMMIT_TYPES>", "chore", "ci", "cd"]],
    }),
  ),
});

type _BaseConfigInput = v.InferInput<typeof BaseCoreConfigSchema>;
type _BaseConfigOutput = v.InferOutput<typeof BaseCoreConfigSchema>;

export const BaseLifecycleConfigSchema = v.object({
  commandHooks: v.pipe(
    v.optional(CommandHooksSchema, {}),
    v.metadata({
      description: "Command hooks to run at different phases of the operation.",
    }),
  ),
});

type _BaseLifecycleConfigInput = v.InferInput<typeof BaseLifecycleConfigSchema>;
type _BaseLifecycleConfigOutput = v.InferOutput<
  typeof BaseLifecycleConfigSchema
>;

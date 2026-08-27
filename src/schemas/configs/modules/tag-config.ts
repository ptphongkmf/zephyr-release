import * as v from "@valibot/valibot";
import { DOCS_EXT_REF_TOKEN } from "../../token.ts";
import { trimNonEmptyStringSchema } from "../../string.ts";
import {
  DEFAULT_TAG_MESSAGE_TEMPLATE,
  DEFAULT_TAG_NAME_TEMPLATE,
  DEFAULT_WORKSPACE_TAG_NAME_TEMPLATE,
} from "../../../constants/defaults/string-templates.ts";
import { TagTypeOptions } from "../../../constants/release-tag-options.ts";
import { TaggerSchema } from "./components/tagger.ts";

const createTagSchema = v.boolean();
const createTagDesc =
  "Enable/disable tag creation. If disabled, create release note will also be skipped.\n";

const nameTemplateSchema = trimNonEmptyStringSchema;
const nameTemplateDesc =
  "String template for tag name, using with string patterns like {{ nextVersion }}. Available in string templates as " +
  "{{ tagName }}. Also used to auto-derive a match pattern for finding existing release tags.\n" +
  "Allowed patterns to use are: all fixed and dynamic string patterns (except {{ tagName }} itself).\n";

const tagTypeSchema = v.enum(TagTypeOptions);
const tagTypeDesc =
  "The type of Git tag to create, either lightweight, annotated or signed.\n" +
  "- If annotated or signed, a tag message is required.\n" +
  "- If signed, you must pre-configure the CI runner environment with GPG/SSH keys yourself (Zephyr Release " +
  "does not manage keys for security reasons).\n";

const messageTemplateSchema = v.string();
const messageTemplateDesc =
  "String template for the Git annotated or signed tag message.\n" +
  "Allowed patterns to use are: all fixed and dynamic string patterns.\n";

const tagConfigDesc = "Configuration specific to tags.";

export const TagConfigSchema = v.pipe(
  v.object({
    createTag: v.pipe(
      v.optional(createTagSchema, true),
      v.metadata({
        description: createTagDesc + "Default: true",
      }),
    ),

    nameTemplate: v.pipe(
      v.optional(nameTemplateSchema, DEFAULT_TAG_NAME_TEMPLATE),
      v.metadata({
        description: nameTemplateDesc +
          `Default: ${JSON.stringify(DEFAULT_TAG_NAME_TEMPLATE)}`,
      }),
    ),
    matchPatterns: v.pipe(
      v.optional(
        v.union([
          trimNonEmptyStringSchema,
          v.pipe(v.array(trimNonEmptyStringSchema), v.nonEmpty()),
        ]),
      ),
      v.transform((input) => {
        if (input !== undefined) {
          return Array.isArray(input) ? input : [input];
        }
        return input;
      }),
      v.metadata({
        description:
          "Additional glob pattern(s) to match existing tags when searching for the last release. " +
          "A pattern is always auto-derived from `nameTemplate`, so this is only needed " +
          "when migrating from a different tag naming convention.",
        examples: [["v*"], ["release-*", "v*"]],
      }),
    ),

    type: v.pipe(
      v.optional(tagTypeSchema, TagTypeOptions.lightweight),
      v.metadata({
        description: tagTypeDesc +
          `Default: ${JSON.stringify(TagTypeOptions.lightweight)}`,
      }),
    ),

    messageTemplate: v.pipe(
      v.optional(messageTemplateSchema, DEFAULT_TAG_MESSAGE_TEMPLATE),
      v.metadata({
        description: messageTemplateDesc +
          `Default: ${JSON.stringify(DEFAULT_TAG_MESSAGE_TEMPLATE)}`,
      }),
    ),
    messageTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing Git annotated or signed tag message template. Overrides `messageTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),

    tagger: v.pipe(
      v.optional(TaggerSchema),
      v.metadata({
        description:
          "Custom identity and timestamp information for the Git tag. If omitted, defaults to the platform native behavior.",
      }),
    ),
  }),
  v.metadata({
    description: tagConfigDesc,
  }),
);

type _TagConfigInput = v.InferInput<typeof TagConfigSchema>;
export type TagConfigOutput = v.InferOutput<typeof TagConfigSchema>;

export const TagConfigPatchSchema = v.pipe(
  v.object(
    {
      createTag: v.pipe(
        v.optional(createTagSchema),
        v.metadata({
          description: createTagDesc + "Default: inherit from root",
        }),
      ),

      nameTemplate: v.pipe(
        v.optional(nameTemplateSchema),
        v.metadata({
          description: nameTemplateDesc +
            `Default: ${DEFAULT_WORKSPACE_TAG_NAME_TEMPLATE}`,
        }),
      ),
      matchPatterns: v.optional(
        v.unwrap(TagConfigSchema.entries.matchPatterns),
      ),

      type: v.pipe(
        v.optional(tagTypeSchema),
        v.metadata({
          description: tagTypeDesc + "Default: inherit from root",
        }),
      ),

      messageTemplate: v.pipe(
        v.optional(messageTemplateSchema),
        v.metadata({
          description: messageTemplateDesc + "Default: inherit from root",
        }),
      ),
      messageTemplatePath: v.optional(
        v.unwrap(TagConfigSchema.entries.messageTemplatePath),
      ),

      tagger: v.optional(
        v.unwrap(TagConfigSchema.entries.tagger),
      ),
    } satisfies Record<keyof TagConfigOutput, unknown>,
  ),
  v.metadata({
    description: tagConfigDesc,
  }),
);

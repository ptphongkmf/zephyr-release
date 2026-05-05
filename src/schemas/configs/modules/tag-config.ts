import * as v from "@valibot/valibot";
import { DOCS_EXT_REF_TOKEN } from "../../token.ts";
import { trimNonEmptyStringSchema } from "../../string.ts";
import {
  DEFAULT_TAG_MESSAGE_TEMPLATE,
  DEFAULT_TAG_NAME_TEMPLATE,
} from "../../../constants/defaults/string-templates.ts";
import { TagTypeOptions } from "../../../constants/release-tag-options.ts";
import { TaggerSchema } from "./components/tagger.ts";

export const TagConfigSchema = v.pipe(
  v.object({
    createTag: v.pipe(
      v.optional(v.boolean(), true),
      v.metadata({
        description:
          "Enable/disable tag creation. If disabled, create release note will also be skipped.\n" +
          "Default: true",
      }),
    ),
    nameTemplate: v.pipe(
      v.optional(trimNonEmptyStringSchema, DEFAULT_TAG_NAME_TEMPLATE),
      v.metadata({
        description:
          "String template for tag name, using with string patterns like {{ nextVersion }}. Available in string templates as " +
          "{{ tagName }}.\n" +
          "Allowed patterns to use are: all fixed and dynamic string patterns (except {{ tagName }} itself).\n" +
          `Default: ${JSON.stringify(DEFAULT_TAG_NAME_TEMPLATE)}`,
      }),
    ),
    type: v.pipe(
      v.optional(v.enum(TagTypeOptions), TagTypeOptions.lightweight),
      v.metadata({
        description:
          "The type of Git tag to create, either lightweight, annotated or signed.\n" +
          "- If annotated or signed, a tag message is required.\n" +
          "- If signed, you must pre-configure the CI runner environment with GPG/SSH keys yourself (Zephyr Release " +
          "does not manage keys for security reasons).\n" +
          `Default: ${JSON.stringify(TagTypeOptions.lightweight)}`,
      }),
    ),
    messageTemplate: v.pipe(
      v.optional(v.string(), DEFAULT_TAG_MESSAGE_TEMPLATE),
      v.metadata({
        description:
          "String template for the Git annotated or signed tag message.\n" +
          "Allowed patterns to use are: all fixed and dynamic string patterns.\n" +
          `Default: ${JSON.stringify(DEFAULT_TAG_MESSAGE_TEMPLATE)}`,
      }),
    ),
    messageTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing Git annotated or signed tag message template. Overrides `messageTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional`,
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
    description: "Configuration specific to tags.",
  }),
);

type _TagConfigInput = v.InferInput<typeof TagConfigSchema>;
export type TagConfigOutput = v.InferOutput<typeof TagConfigSchema>;

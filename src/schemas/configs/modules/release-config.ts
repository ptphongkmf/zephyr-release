import * as v from "@valibot/valibot";
import { DOCS_EXT_REF_TOKEN } from "../../token.ts";
import {
  DEFAULT_RELEASE_BODY_TEMPLATE,
  DEFAULT_RELEASE_TITLE_TEMPLATE,
} from "../../../constants/defaults/string-templates.ts";
import { trimNonEmptyStringSchema } from "../../string.ts";

export const ReleaseConfigSchema = v.pipe(
  v.object({
    createRelease: v.pipe(
      v.optional(v.boolean(), true),
      v.metadata({
        description: "Enable/disable release creation.\n" +
          "Default: true",
      }),
    ),
    prerelease: v.pipe(
      v.optional(v.boolean(), false),
      v.metadata({
        description: "If enabled, the release will be marked as prerelease.\n" +
          "Default: false",
      }),
    ),
    draft: v.pipe(
      v.optional(v.boolean(), false),
      v.metadata({
        description: "If enabled, the release will be created as draft.\n" +
          "Default: false",
      }),
    ),
    setLatest: v.pipe(
      v.optional(v.boolean(), true),
      v.metadata({
        description:
          "If enabled, the release will be set as the latest release.\n" +
          "Default: true",
      }),
    ),

    titleTemplate: v.pipe(
      v.optional(v.string(), DEFAULT_RELEASE_TITLE_TEMPLATE),
      v.metadata({
        description:
          "String template for release note title, using with string patterns like {{ tagName }}.\n" +
          "Allowed patterns to use are: all fixed and dynamic string patterns.\n" +
          `Default: ${JSON.stringify(DEFAULT_RELEASE_TITLE_TEMPLATE)}`,
      }),
    ),
    titleTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing release title template. Overrides `titleTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),
    headerTemplate: v.pipe(
      v.optional(v.string()),
      v.metadata({
        description:
          "String template for release note header, using with string patterns.\n" +
          "Allowed patterns to use are: all fixed and dynamic string patterns.",
      }),
    ),
    headerTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing release header template. Overrides `headerTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),
    bodyTemplate: v.pipe(
      v.optional(v.string(), DEFAULT_RELEASE_BODY_TEMPLATE),
      v.metadata({
        description:
          "String template for release note body, using with string patterns like {{ changelogRelease }}.\n" +
          "Allowed patterns to use are: all fixed and dynamic string patterns.\n" +
          `Default: ${JSON.stringify(DEFAULT_RELEASE_BODY_TEMPLATE)}`,
      }),
    ),
    bodyTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing release body template. Overrides `bodyTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),
    footerTemplate: v.pipe(
      v.optional(v.string()),
      v.metadata({
        description:
          "String template for release note footer, using with string patterns.\n" +
          "Allowed patterns to use are: all fixed and dynamic string patterns.",
      }),
    ),
    footerTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing release footer template. Overrides `footerTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),

    assets: v.pipe(
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
        description: "List of local asset path(s) to attach to the release.",
      }),
    ),
  }),
  v.metadata({
    description: "Configuration specific to releases.",
  }),
);

type _ReleaseConfigInput = v.InferInput<typeof ReleaseConfigSchema>;
export type ReleaseConfigOutput = v.InferOutput<typeof ReleaseConfigSchema>;

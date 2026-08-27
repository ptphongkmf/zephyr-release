import * as v from "@valibot/valibot";
import { DOCS_EXT_REF_TOKEN } from "../../token.ts";
import {
  DEFAULT_RELEASE_BODY_TEMPLATE,
  DEFAULT_RELEASE_TITLE_TEMPLATE,
} from "../../../constants/defaults/string-templates.ts";
import { trimNonEmptyStringSchema } from "../../string.ts";

const releaseCreateReleaseSchema = v.boolean();
const releaseCreateReleaseDesc = "Enable/disable release creation.\n";

const releasePrereleaseSchema = v.boolean();
const releasePrereleaseDesc =
  "If enabled, the release will be marked as prerelease.\n";

const releaseDraftSchema = v.boolean();
const releaseDraftDesc =
  "If enabled, the release will be created as draft.\n";

const releaseSetLatestSchema = v.boolean();
const releaseSetLatestDesc =
  "If enabled, the release will be set as the latest release.\n";

const releaseTitleTemplateSchema = v.string();
const releaseTitleTemplateDesc =
  "String template for release note title, using with string patterns like {{ tagName }}.\n" +
  "Allowed patterns to use are: all fixed and dynamic string patterns.\n";

const releaseBodyTemplateSchema = v.string();
const releaseBodyTemplateDesc =
  "String template for release note body, using with string patterns like {{ changelogRelease }}.\n" +
  "Allowed patterns to use are: all fixed and dynamic string patterns.\n";

const releaseConfigDesc = "Configuration specific to releases.";

export const ReleaseConfigSchema = v.pipe(
  v.object({
    createRelease: v.pipe(
      v.optional(releaseCreateReleaseSchema, true),
      v.metadata({
        description: releaseCreateReleaseDesc + "Default: true",
      }),
    ),
    prerelease: v.pipe(
      v.optional(releasePrereleaseSchema, false),
      v.metadata({
        description: releasePrereleaseDesc + "Default: false",
      }),
    ),
    draft: v.pipe(
      v.optional(releaseDraftSchema, false),
      v.metadata({
        description: releaseDraftDesc + "Default: false",
      }),
    ),
    setLatest: v.pipe(
      v.optional(releaseSetLatestSchema, true),
      v.metadata({
        description: releaseSetLatestDesc + "Default: true",
      }),
    ),

    titleTemplate: v.pipe(
      v.optional(releaseTitleTemplateSchema, DEFAULT_RELEASE_TITLE_TEMPLATE),
      v.metadata({
        description: releaseTitleTemplateDesc +
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
      v.optional(releaseBodyTemplateSchema, DEFAULT_RELEASE_BODY_TEMPLATE),
      v.metadata({
        description: releaseBodyTemplateDesc +
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
    description: releaseConfigDesc,
  }),
);

type _ReleaseConfigInput = v.InferInput<typeof ReleaseConfigSchema>;
export type ReleaseConfigOutput = v.InferOutput<typeof ReleaseConfigSchema>;

export const ReleaseConfigPatchSchema = v.pipe(
  v.object(
    {
      createRelease: v.pipe(
        v.optional(releaseCreateReleaseSchema),
        v.metadata({
          description: releaseCreateReleaseDesc +
            "Default: inherit from root",
        }),
      ),
      prerelease: v.pipe(
        v.optional(releasePrereleaseSchema),
        v.metadata({
          description: releasePrereleaseDesc + "Default: inherit from root",
        }),
      ),
      draft: v.pipe(
        v.optional(releaseDraftSchema),
        v.metadata({
          description: releaseDraftDesc + "Default: inherit from root",
        }),
      ),
      setLatest: v.pipe(
        v.optional(releaseSetLatestSchema),
        v.metadata({
          description: releaseSetLatestDesc + "Default: inherit from root",
        }),
      ),

      titleTemplate: v.pipe(
        v.optional(releaseTitleTemplateSchema),
        v.metadata({
          description: releaseTitleTemplateDesc +
            "Default: inherit from root",
        }),
      ),
      titleTemplatePath: v.optional(
        v.unwrap(ReleaseConfigSchema.entries.titleTemplatePath),
      ),
      headerTemplate: v.optional(
        v.unwrap(ReleaseConfigSchema.entries.headerTemplate),
      ),
      headerTemplatePath: v.optional(
        v.unwrap(ReleaseConfigSchema.entries.headerTemplatePath),
      ),
      bodyTemplate: v.pipe(
        v.optional(releaseBodyTemplateSchema),
        v.metadata({
          description: releaseBodyTemplateDesc + "Default: inherit from root",
        }),
      ),
      bodyTemplatePath: v.optional(
        v.unwrap(ReleaseConfigSchema.entries.bodyTemplatePath),
      ),
      footerTemplate: v.optional(
        v.unwrap(ReleaseConfigSchema.entries.footerTemplate),
      ),
      footerTemplatePath: v.optional(
        v.unwrap(ReleaseConfigSchema.entries.footerTemplatePath),
      ),

      assets: v.optional(
        v.unwrap(ReleaseConfigSchema.entries.assets),
      ),
    } satisfies Record<keyof ReleaseConfigOutput, unknown>,
  ),
  v.metadata({
    description: releaseConfigDesc,
  }),
);

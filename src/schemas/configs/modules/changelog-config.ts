import * as v from "@valibot/valibot";
import { DOCS_EXT_REF_TOKEN } from "../../token.ts";
import {
  DEFAULT_CHANGELOG_FILE_HEADER_TEMPLATE,
  DEFAULT_CHANGELOG_RELEASE_TEMPLATE,
  DEFAULT_RELEASE_BREAKING_SECTION_ENTRY_TEMPLATE,
  DEFAULT_RELEASE_HEADER_TEMPLATE,
  DEFAULT_RELEASE_SECTION_ENTRY_TEMPLATE,
  DEFAULT_RELEASE_SECTION_HEADING_TEMPLATE,
  DEFAULT_RELEASE_SECTION_HEADING_TEMPLATE_ALT,
} from "../../../constants/defaults/string-templates.ts";
import { trimNonEmptyStringSchema } from "../../string.ts";
import {
  CommitGroupModes,
  CommitSortOrders,
} from "../../../constants/changelog-commit-options.ts";

const changelogWriteToFileSchema = v.boolean();
const changelogWriteToFileDesc =
  "Enable/disable writing changelog to file. When disabled, changelogs are still generated for proposals, " +
  "releases and string templates.\n";

const changelogPathSchema = trimNonEmptyStringSchema;
const changelogPathDesc =
  "Path to the file where the generated changelog will be written to, relative to the project root.\n" +
  "In monorepo mode, this path is relative to the workspace directory (auto-prepended with the workspace path key).\n" +
  `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional \n`;

const changelogCommitGroupModeSchema = v.enum(CommitGroupModes);
const changelogCommitGroupModeDesc =
  "Defines how commits are sub-grouped within their respective changelog sections (Features, Fixes, etc.).\n" +
  '- "none": Commits are rendered as a single flat list.\n' +
  '- "scope-first": Commits are grouped by their scope. Scoped groups appear at the top, and unscoped commits fall to the bottom.\n' +
  '- "scope-last": Commits are grouped by their scope. Unscoped commits sit at the top, and scoped groups follow below.\n';

const changelogCommitSortOrderSchema = v.enum(CommitSortOrders);
const changelogCommitSortOrderDesc =
  "Defines the sorting algorithm used to order the commits (and their groups, if a grouping mode is used).\n" +
  '- "alphabetical": Sorts alphabetically from A to Z.\n' +
  '- "newest-first": Sorts by commit timestamp, placing the newest commits at the top.\n' +
  '- "oldest-first": Sorts by commit timestamp, placing the oldest commits at the top.\n';

const changelogFileHeaderTemplateSchema = v.string();
const changelogFileHeaderTemplateDesc =
  "String template for changelog file header, using with string patterns like {{ nextVersion }}. Placed above any changelog content.\n" +
  "Allowed patterns to use are: all fixed and dynamic string patterns.\n";

const changelogFileReleaseTemplateSchema = v.string();
const changelogFileReleaseTemplateDesc =
  "String template for the individual release block inserted into the changelog file.\n" +
  'To use your alternative configuration, set this to "{{ changelogReleaseAlt }}".\n';

const changelogReleaseHeaderTemplateSchema = v.pipe(v.string(), v.nonEmpty());
const changelogReleaseHeaderTemplateDesc =
  "String template for header of a changelog release, using with string patterns like {{ nextVersion }}.\n" +
  "Allowed patterns to use are: all fixed and dynamic string patterns.\n";

const changelogReleaseSectionHeadingTemplateSchema = v.pipe(
  v.string(),
  v.nonEmpty(),
);
const changelogReleaseSectionHeadingTemplateDesc =
  "String template for heading of a changelog release section, using with string patterns like {{ section }}.\n" +
  "Allowed patterns to use are: all fixed and dynamic string patterns.\n" +
  "Additionally, you can use special dynamic patterns like: {{ section }}, {{ sectionAlt }}.\n";

const changelogReleaseSectionEntryTemplateSchema = v.pipe(
  v.string(),
  v.nonEmpty(),
);
const changelogReleaseSectionEntryTemplateDesc =
  "String template for each entries in the changelog release sections. " +
  "Allowed patterns to use are: all fixed and dynamic string patterns.\n" +
  "Additionally, you can use a special set of dynamic patterns which are:\n" +
  "{{ hash }}, {{ type }}, {{ scope }}, {{ desc }}, {{ body }}, {{ footer }}, {{ breakingDesc }}, {{ isBreaking }}, " +
  "{{ authorName }}, {{ authorEmail }}, {{ authorDate }}, {{ committerName }}, {{ committerEmail }}, {{ committerDate }}.\n" +
  `About special patterns: ${DOCS_EXT_REF_TOKEN}/docs/config-options.md#changelog--release-section-entry-template-optional\n`;

const changelogReleaseBreakingSectionHeadingSchema = v.string();
const changelogReleaseBreakingSectionHeadingDesc =
  "Heading of a changelog release BREAKING section.\n";

const changelogReleaseBreakingSectionEntryTemplateSchema = v.pipe(
  v.string(),
  v.nonEmpty(),
);
const changelogReleaseBreakingSectionEntryTemplateDesc =
  "Basically the same as `releaseSectionEntryTemplate`, but for breaking changes specifically. If not provided, falls back " +
  "to `releaseSectionEntryTemplate`.\n" +
  "Allowed patterns to use are: all fixed and dynamic string patterns.\n";

const changelogReleaseSectionHeadingTemplateAltSchema = v.pipe(
  v.string(),
  v.nonEmpty(),
);
const changelogReleaseSectionHeadingTemplateAltDesc =
  "String template for alternative heading of a changelog release section. Allowed string patterns and special dynamic patterns are the same as `releaseSectionHeadingTemplate`.\n";

const changelogConfigDesc =
  "Configuration specific to changelogs. All generated changelog content are available in string templates as " +
  "{{ changelogRelease }} (release header + body) or {{ changelogReleaseHeader }} and {{ changelogReleaseBody }}.";

export const ChangelogConfigSchema = v.pipe(
  v.object({
    writeToFile: v.pipe(
      v.optional(changelogWriteToFileSchema, true),
      v.metadata({
        description: changelogWriteToFileDesc + "Default: true",
      }),
    ),
    path: v.pipe(
      v.optional(changelogPathSchema, "CHANGELOG.md"),
      v.metadata({
        description: changelogPathDesc + 'Default: "CHANGELOG.md"',
      }),
    ),

    commitGroupMode: v.pipe(
      v.optional(changelogCommitGroupModeSchema, CommitGroupModes.scopeLast),
      v.metadata({
        description: changelogCommitGroupModeDesc +
          `Default: "${CommitGroupModes.scopeLast}"`,
      }),
    ),
    commitSortOrder: v.pipe(
      v.optional(changelogCommitSortOrderSchema, CommitSortOrders.alphabetical),
      v.metadata({
        description: changelogCommitSortOrderDesc +
          `Default: "${CommitSortOrders.alphabetical}"`,
      }),
    ),

    fileHeaderTemplate: v.pipe(
      v.optional(
        changelogFileHeaderTemplateSchema,
        DEFAULT_CHANGELOG_FILE_HEADER_TEMPLATE,
      ),
      v.metadata({
        description: changelogFileHeaderTemplateDesc +
          `Default: ${JSON.stringify(DEFAULT_CHANGELOG_FILE_HEADER_TEMPLATE)}`,
      }),
    ),
    fileHeaderTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing changelog file header. Overrides `fileHeaderTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),
    fileReleaseTemplate: v.pipe(
      v.optional(
        changelogFileReleaseTemplateSchema,
        DEFAULT_CHANGELOG_RELEASE_TEMPLATE,
      ),
      v.metadata({
        description: changelogFileReleaseTemplateDesc +
          `Default: ${JSON.stringify(DEFAULT_CHANGELOG_RELEASE_TEMPLATE)}`,
      }),
    ),
    fileReleaseTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing changelog release template. Overrides `fileReleaseTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),
    fileFooterTemplate: v.pipe(
      v.optional(v.string()),
      v.metadata({
        description:
          "String template for changelog file footer, using with string patterns like {{ nextVersion }}. Placed below any changelog content.\n" +
          "Allowed patterns to use are: all fixed and dynamic string patterns.",
      }),
    ),
    fileFooterTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing changelog file footer. Overrides `fileFooterTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),

    releaseHeaderTemplate: v.pipe(
      v.optional(
        changelogReleaseHeaderTemplateSchema,
        DEFAULT_RELEASE_HEADER_TEMPLATE,
      ),
      v.metadata({
        description: changelogReleaseHeaderTemplateDesc +
          `Default: ${JSON.stringify(DEFAULT_RELEASE_HEADER_TEMPLATE)}`,
      }),
    ),
    releaseHeaderTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing changelog release header. Overrides `releaseHeaderTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),
    releaseSectionHeadingTemplate: v.pipe(
      v.optional(
        changelogReleaseSectionHeadingTemplateSchema,
        DEFAULT_RELEASE_SECTION_HEADING_TEMPLATE,
      ),
      v.metadata({
        description: changelogReleaseSectionHeadingTemplateDesc +
          `Default: ${
            JSON.stringify(DEFAULT_RELEASE_SECTION_HEADING_TEMPLATE)
          }`,
      }),
    ),
    releaseSectionHeadingTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing changelog release section heading template. Overrides `releaseSectionHeadingTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),
    releaseSectionEntryTemplate: v.pipe(
      v.optional(
        changelogReleaseSectionEntryTemplateSchema,
        DEFAULT_RELEASE_SECTION_ENTRY_TEMPLATE,
      ),
      v.metadata({
        description: changelogReleaseSectionEntryTemplateDesc +
          `Default: ${JSON.stringify(DEFAULT_RELEASE_SECTION_ENTRY_TEMPLATE)}`,
      }),
    ),
    releaseSectionEntryTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing changelog release section entry template. Overrides `releaseSectionEntryTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),
    releaseBreakingSectionHeading: v.pipe(
      v.optional(
        changelogReleaseBreakingSectionHeadingSchema,
        "### ⚠ BREAKING CHANGES",
      ),
      v.metadata({
        description: changelogReleaseBreakingSectionHeadingDesc +
          'Default: "### ⚠ BREAKING CHANGES"',
      }),
    ),
    releaseBreakingSectionEntryTemplate: v.pipe(
      v.optional(
        changelogReleaseBreakingSectionEntryTemplateSchema,
        DEFAULT_RELEASE_BREAKING_SECTION_ENTRY_TEMPLATE,
      ),
      v.metadata({
        description: changelogReleaseBreakingSectionEntryTemplateDesc +
          `Default: ${
            JSON.stringify(DEFAULT_RELEASE_BREAKING_SECTION_ENTRY_TEMPLATE)
          }`,
      }),
    ),
    releaseBreakingSectionEntryTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing changelog release breaking section entry template. Overrides `releaseBreakingSectionEntryTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),
    releaseBodyOverride: v.pipe(
      v.optional(v.pipe(v.string(), v.nonEmpty())),
      v.metadata({
        description:
          "User-provided changelog release body, available in string templates as {{ changelogReleaseBody }}. If set, completely " +
          "ignores the built-in generation and uses this value as the content. Should only be set dynamically, not " +
          "in static config.",
      }),
    ),
    releaseBodyOverridePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing changelog release body override, will take precedence over `releaseBodyOverride`.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),
    releaseFooterTemplate: v.pipe(
      v.optional(v.string()),
      v.metadata({
        description:
          "String template for footer of a changelog release, using with string patterns.\n" +
          "Allowed patterns to use are: all fixed and dynamic string patterns.",
      }),
    ),
    releaseFooterTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing changelog release footer. Overrides `releaseFooterTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),

    releaseHeaderTemplateAlt: v.pipe(
      v.optional(v.pipe(v.string(), v.nonEmpty())),
      v.metadata({
        description:
          "Alternative value for `releaseHeaderTemplate`. When not provided, fall back to the original.",
      }),
    ),
    releaseHeaderTemplateAltPath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing alternative changelog release header. Overrides `releaseHeaderTemplateAlt` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),
    releaseSectionHeadingTemplateAlt: v.pipe(
      v.optional(
        changelogReleaseSectionHeadingTemplateAltSchema,
        DEFAULT_RELEASE_SECTION_HEADING_TEMPLATE_ALT,
      ),
      v.metadata({
        description: changelogReleaseSectionHeadingTemplateAltDesc +
          `Default: ${
            JSON.stringify(DEFAULT_RELEASE_SECTION_HEADING_TEMPLATE_ALT)
          }`,
      }),
    ),
    releaseSectionHeadingTemplateAltPath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing alternative changelog release section heading template. Overrides `releaseSectionHeadingTemplateAlt` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),
    releaseSectionEntryTemplateAlt: v.pipe(
      v.optional(v.pipe(v.string(), v.nonEmpty())),
      v.metadata({
        description:
          "Alternative value for `releaseSectionEntryTemplate`. When not provided, fall back to the original.",
      }),
    ),
    releaseSectionEntryTemplateAltPath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing alternative changelog release section entry template. Overrides `releaseSectionEntryTemplateAlt` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),
    releaseBreakingSectionHeadingAlt: v.pipe(
      v.optional(v.string()),
      v.metadata({
        description:
          "Alternative value for `releaseBreakingSectionHeading`. When not provided, fall back to the original.",
      }),
    ),
    releaseBreakingSectionEntryTemplateAlt: v.pipe(
      v.optional(v.pipe(v.string(), v.nonEmpty())),
      v.metadata({
        description:
          "Alternative value for `releaseBreakingSectionEntryTemplate`. When not provided, fall back to the original.",
      }),
    ),
    releaseBreakingSectionEntryTemplateAltPath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing alternative changelog release breaking section entry template. Overrides `releaseBreakingSectionEntryTemplateAlt` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),
    releaseBodyOverrideAlt: v.pipe(
      v.optional(v.pipe(v.string(), v.nonEmpty())),
      v.metadata({
        description:
          "Alternative value for `releaseBodyOverride`. When not provided, fall back to the original.",
      }),
    ),
    releaseBodyOverrideAltPath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing alternative changelog release body override. Overrides `releaseBodyOverrideAlt` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),
    releaseFooterTemplateAlt: v.pipe(
      v.optional(v.string()),
      v.metadata({
        description:
          "Alternative value for `releaseFooterTemplate`. When not provided, fall back to the original.",
      }),
    ),
    releaseFooterTemplateAltPath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing alternative changelog release footer. Overrides `releaseFooterTemplateAlt` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),
  }),
  v.metadata({
    description: changelogConfigDesc,
  }),
);

type _ChangelogConfigInput = v.InferInput<typeof ChangelogConfigSchema>;
export type ChangelogConfigOutput = v.InferOutput<typeof ChangelogConfigSchema>;

export const ChangelogConfigPatchSchema = v.pipe(
  v.object(
    {
      writeToFile: v.pipe(
        v.optional(changelogWriteToFileSchema),
        v.metadata({
          description: changelogWriteToFileDesc +
            "Default: inherit from root",
        }),
      ),
      path: v.pipe(
        v.optional(changelogPathSchema),
        v.metadata({
          description: changelogPathDesc + "Default: inherit from root",
        }),
      ),

      commitGroupMode: v.pipe(
        v.optional(changelogCommitGroupModeSchema),
        v.metadata({
          description: changelogCommitGroupModeDesc +
            "Default: inherit from root",
        }),
      ),
      commitSortOrder: v.pipe(
        v.optional(changelogCommitSortOrderSchema),
        v.metadata({
          description: changelogCommitSortOrderDesc +
            "Default: inherit from root",
        }),
      ),

      fileHeaderTemplate: v.pipe(
        v.optional(changelogFileHeaderTemplateSchema),
        v.metadata({
          description: changelogFileHeaderTemplateDesc +
            "Default: inherit from root",
        }),
      ),
      fileHeaderTemplatePath: v.optional(
        v.unwrap(ChangelogConfigSchema.entries.fileHeaderTemplatePath),
      ),
      fileReleaseTemplate: v.pipe(
        v.optional(changelogFileReleaseTemplateSchema),
        v.metadata({
          description: changelogFileReleaseTemplateDesc +
            "Default: inherit from root",
        }),
      ),
      fileReleaseTemplatePath: v.optional(
        v.unwrap(ChangelogConfigSchema.entries.fileReleaseTemplatePath),
      ),
      fileFooterTemplate: v.optional(
        v.unwrap(ChangelogConfigSchema.entries.fileFooterTemplate),
      ),
      fileFooterTemplatePath: v.optional(
        v.unwrap(ChangelogConfigSchema.entries.fileFooterTemplatePath),
      ),

      releaseHeaderTemplate: v.pipe(
        v.optional(changelogReleaseHeaderTemplateSchema),
        v.metadata({
          description: changelogReleaseHeaderTemplateDesc +
            "Default: inherit from root",
        }),
      ),
      releaseHeaderTemplatePath: v.optional(
        v.unwrap(ChangelogConfigSchema.entries.releaseHeaderTemplatePath),
      ),
      releaseSectionHeadingTemplate: v.pipe(
        v.optional(changelogReleaseSectionHeadingTemplateSchema),
        v.metadata({
          description: changelogReleaseSectionHeadingTemplateDesc +
            "Default: inherit from root",
        }),
      ),
      releaseSectionHeadingTemplatePath: v.optional(
        v.unwrap(
          ChangelogConfigSchema.entries.releaseSectionHeadingTemplatePath,
        ),
      ),
      releaseSectionEntryTemplate: v.pipe(
        v.optional(changelogReleaseSectionEntryTemplateSchema),
        v.metadata({
          description: changelogReleaseSectionEntryTemplateDesc +
            "Default: inherit from root",
        }),
      ),
      releaseSectionEntryTemplatePath: v.optional(
        v.unwrap(
          ChangelogConfigSchema.entries.releaseSectionEntryTemplatePath,
        ),
      ),
      releaseBreakingSectionHeading: v.pipe(
        v.optional(changelogReleaseBreakingSectionHeadingSchema),
        v.metadata({
          description: changelogReleaseBreakingSectionHeadingDesc +
            "Default: inherit from root",
        }),
      ),
      releaseBreakingSectionEntryTemplate: v.pipe(
        v.optional(changelogReleaseBreakingSectionEntryTemplateSchema),
        v.metadata({
          description: changelogReleaseBreakingSectionEntryTemplateDesc +
            "Default: inherit from root",
        }),
      ),
      releaseBreakingSectionEntryTemplatePath: v.optional(
        v.unwrap(
          ChangelogConfigSchema.entries
            .releaseBreakingSectionEntryTemplatePath,
        ),
      ),
      releaseBodyOverride: v.optional(
        v.unwrap(ChangelogConfigSchema.entries.releaseBodyOverride),
      ),
      releaseBodyOverridePath: v.optional(
        v.unwrap(ChangelogConfigSchema.entries.releaseBodyOverridePath),
      ),
      releaseFooterTemplate: v.optional(
        v.unwrap(ChangelogConfigSchema.entries.releaseFooterTemplate),
      ),
      releaseFooterTemplatePath: v.optional(
        v.unwrap(ChangelogConfigSchema.entries.releaseFooterTemplatePath),
      ),

      releaseHeaderTemplateAlt: v.optional(
        v.unwrap(ChangelogConfigSchema.entries.releaseHeaderTemplateAlt),
      ),
      releaseHeaderTemplateAltPath: v.optional(
        v.unwrap(
          ChangelogConfigSchema.entries.releaseHeaderTemplateAltPath,
        ),
      ),
      releaseSectionHeadingTemplateAlt: v.pipe(
        v.optional(changelogReleaseSectionHeadingTemplateAltSchema),
        v.metadata({
          description: changelogReleaseSectionHeadingTemplateAltDesc +
            "Default: inherit from root",
        }),
      ),
      releaseSectionHeadingTemplateAltPath: v.optional(
        v.unwrap(
          ChangelogConfigSchema.entries.releaseSectionHeadingTemplateAltPath,
        ),
      ),
      releaseSectionEntryTemplateAlt: v.optional(
        v.unwrap(
          ChangelogConfigSchema.entries.releaseSectionEntryTemplateAlt,
        ),
      ),
      releaseSectionEntryTemplateAltPath: v.optional(
        v.unwrap(
          ChangelogConfigSchema.entries.releaseSectionEntryTemplateAltPath,
        ),
      ),
      releaseBreakingSectionHeadingAlt: v.optional(
        v.unwrap(
          ChangelogConfigSchema.entries.releaseBreakingSectionHeadingAlt,
        ),
      ),
      releaseBreakingSectionEntryTemplateAlt: v.optional(
        v.unwrap(
          ChangelogConfigSchema.entries
            .releaseBreakingSectionEntryTemplateAlt,
        ),
      ),
      releaseBreakingSectionEntryTemplateAltPath: v.optional(
        v.unwrap(
          ChangelogConfigSchema.entries
            .releaseBreakingSectionEntryTemplateAltPath,
        ),
      ),
      releaseBodyOverrideAlt: v.optional(
        v.unwrap(ChangelogConfigSchema.entries.releaseBodyOverrideAlt),
      ),
      releaseBodyOverrideAltPath: v.optional(
        v.unwrap(ChangelogConfigSchema.entries.releaseBodyOverrideAltPath),
      ),
      releaseFooterTemplateAlt: v.optional(
        v.unwrap(ChangelogConfigSchema.entries.releaseFooterTemplateAlt),
      ),
      releaseFooterTemplateAltPath: v.optional(
        v.unwrap(
          ChangelogConfigSchema.entries.releaseFooterTemplateAltPath,
        ),
      ),
    } satisfies Record<keyof ChangelogConfigOutput, unknown>,
  ),
  v.metadata({
    description: changelogConfigDesc,
  }),
);

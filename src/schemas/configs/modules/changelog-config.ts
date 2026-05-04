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

export const ChangelogConfigSchema = v.pipe(
  v.object({
    writeToFile: v.pipe(
      v.optional(v.boolean(), true),
      v.metadata({
        description:
          "Enable/disable writing changelog to file. When disabled, changelogs are still generated for proposals, " +
          "releases and string templates.\n" +
          "Default: true",
      }),
    ),
    path: v.pipe(
      v.optional(trimNonEmptyStringSchema, "CHANGELOG.md"),
      v.metadata({
        description:
          "Path to the file where the generated changelog will be written to, relative to the project root.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional \n` +
          'Default: "CHANGELOG.md"',
      }),
    ),

    commitGroupMode: v.pipe(
      v.optional(v.enum(CommitGroupModes), CommitGroupModes.none),
      v.metadata({
        description:
          "Defines how commits are sub-grouped within their respective changelog sections (Features, Fixes, etc.).\n" +
          "- `none`: Commits are rendered as a single flat list.\n" +
          "- `scope-first`: Commits are grouped by their scope. Scoped groups appear at the top, and unscoped commits fall to the bottom.\n" +
          "- `scope-last`: Commits are grouped by their scope. Unscoped commits sit at the top, and scoped groups follow below.\n" +
          `Default: "${CommitGroupModes.none}"`,
      }),
    ),
    commitSortOrder: v.pipe(
      v.optional(v.enum(CommitSortOrders), CommitSortOrders.alphabetical),
      v.metadata({
        description:
          "Defines the sorting algorithm used to order the commits (and their groups, if a grouping mode is used).\n" +
          "- `alphabetical`: Sorts alphabetically from A to Z.\n" +
          "- `oldest-first`: Sorts by commit timestamp, placing the oldest commits at the top.\n" +
          "- `newest-first`: Sorts by commit timestamp, placing the newest commits at the top.\n" +
          `Default: "${CommitSortOrders.alphabetical}"`,
      }),
    ),

    fileHeaderTemplate: v.pipe(
      v.optional(v.string(), DEFAULT_CHANGELOG_FILE_HEADER_TEMPLATE),
      v.metadata({
        description:
          "String template for changelog file header, using with string patterns like {{ nextVersion }}. Placed above any changelog content.\n" +
          "Allowed patterns to use are: all fixed and dynamic string patterns.\n" +
          `Default: ${JSON.stringify(DEFAULT_CHANGELOG_FILE_HEADER_TEMPLATE)}`,
      }),
    ),
    fileHeaderTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing changelog file header. Overrides `fileHeaderTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional`,
      }),
    ),
    fileReleaseTemplate: v.pipe(
      v.optional(v.string(), DEFAULT_CHANGELOG_RELEASE_TEMPLATE),
      v.metadata({
        description:
          "String template for the individual release block inserted into the changelog file.\n" +
          'To use your alternative configuration, set this to "{{ changelogReleaseAlt }}".\n' +
          `Default: ${JSON.stringify(DEFAULT_CHANGELOG_RELEASE_TEMPLATE)}`,
      }),
    ),
    fileReleaseTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing changelog release template. Overrides `fileReleaseTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional`,
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
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional`,
      }),
    ),

    releaseHeaderTemplate: v.pipe(
      v.optional(
        v.pipe(v.string(), v.nonEmpty()),
        DEFAULT_RELEASE_HEADER_TEMPLATE,
      ),
      v.metadata({
        description:
          "String template for header of a changelog release, using with string patterns like {{ nextVersion }}.\n" +
          "Allowed patterns to use are: all fixed and dynamic string patterns.\n" +
          `Default: ${JSON.stringify(DEFAULT_RELEASE_HEADER_TEMPLATE)}`,
      }),
    ),
    releaseHeaderTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing changelog release header. Overrides `releaseHeaderTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional`,
      }),
    ),

    releaseSectionHeadingTemplate: v.pipe(
      v.optional(
        v.pipe(v.string(), v.nonEmpty()),
        DEFAULT_RELEASE_SECTION_HEADING_TEMPLATE,
      ),
      v.metadata({
        description:
          "String template for heading of a changelog release section, using with string patterns like {{ section }}.\n" +
          "Allowed patterns to use are: all fixed and dynamic string patterns.\n" +
          "Additionally, you can use special dynamic patterns like: {{ section }}, {{ sectionAlt }}.\n" +
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
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional`,
      }),
    ),
    releaseSectionEntryTemplate: v.pipe(
      v.optional(
        v.pipe(v.string(), v.nonEmpty()),
        DEFAULT_RELEASE_SECTION_ENTRY_TEMPLATE,
      ),
      v.metadata({
        description:
          "String template for each entries in the changelog release sections. " +
          "Allowed patterns to use are: all fixed and dynamic string patterns.\n" +
          "Additionally, you can use a special set of dynamic patterns which are:\n" +
          "{{ hash }}, {{ type }}, {{ scope }}, {{ desc }}, {{ body }}, {{ footer }}, {{ breakingDesc }}, {{ isBreaking }}.\n" +
          `About special patterns: ${DOCS_EXT_REF_TOKEN}/docs/config-options.md#changelog--release-section-entry-template-optional\n` +
          `Default: ${JSON.stringify(DEFAULT_RELEASE_SECTION_ENTRY_TEMPLATE)}`,
      }),
    ),
    releaseSectionEntryTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing changelog release section entry template. Overrides `releaseSectionEntryTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional`,
      }),
    ),
    releaseBreakingSectionHeading: v.pipe(
      v.optional(v.string(), "### ⚠ BREAKING CHANGES"),
      v.metadata({
        description: "Heading of a changelog release BREAKING section.",
      }),
    ),
    releaseBreakingSectionEntryTemplate: v.pipe(
      v.optional(
        v.pipe(v.string(), v.nonEmpty()),
        DEFAULT_RELEASE_BREAKING_SECTION_ENTRY_TEMPLATE,
      ),
      v.metadata({
        description:
          "Basically the same as `releaseSectionEntryTemplate`, but for breaking changes specifically. If not provided, falls back " +
          "to `releaseSectionEntryTemplate`.\n" +
          "Allowed patterns to use are: all fixed and dynamic string patterns.\n" +
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
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional`,
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
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional`,
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
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional`,
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
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional`,
      }),
    ),
    releaseSectionHeadingTemplateAlt: v.pipe(
      v.optional(
        v.pipe(v.string(), v.nonEmpty()),
        DEFAULT_RELEASE_SECTION_HEADING_TEMPLATE_ALT,
      ),
      v.metadata({
        description:
          "String template for alternative heading of a changelog release section. Allowed string patterns and special dynamic patterns are the same as `releaseSectionHeadingTemplate`.\n" +
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
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional`,
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
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional`,
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
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional`,
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
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional`,
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
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional`,
      }),
    ),
  }),
  v.metadata({
    description:
      "Configuration specific to changelogs. All generated changelog content are available in string templates as " +
      "{{ changelogRelease }} (release header + body) or {{ changelogReleaseHeader }} and {{ changelogReleaseBody }}.",
  }),
);

type _ChangelogConfigInput = v.InferInput<typeof ChangelogConfigSchema>;
export type ChangelogConfigOutput = v.InferOutput<typeof ChangelogConfigSchema>;

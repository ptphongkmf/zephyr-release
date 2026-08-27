import * as v from "@valibot/valibot";
import { DOCS_EXT_REF_TOKEN } from "../../token.ts";
import { trimNonEmptyStringSchema } from "../../string.ts";
import {
  DEFAULT_PROPOSAL_BODY_TEMPLATE,
  DEFAULT_PROPOSAL_FOOTER_TEMPLATE,
  DEFAULT_PROPOSAL_HEADER_TEMPLATE,
  DEFAULT_PROPOSAL_TITLE_TEMPLATE,
  DEFAULT_WORKING_BRANCH_NAME_TEMPLATE,
  DEFAULT_WORKSPACE_WORKING_BRANCH_NAME_TEMPLATE,
} from "../../../constants/defaults/string-templates.ts";
import { ReviewLabelsSchema } from "./components/review-labels.ts";

const reviewDraftSchema = v.boolean();
const reviewDraftDesc = "If enabled, the proposal will be created as draft.\n";

const reviewGroupProposalsSchema = v.boolean();
const reviewGroupProposalsDesc =
  "When true (default), all workspace changes are grouped into a single proposal.\n" +
  "When false, each workspace gets its own proposal with its own working branch.\n" +
  "Only meaningful in monorepo mode.\n";

const reviewWorkingBranchNameTemplateSchema = trimNonEmptyStringSchema;
const reviewWorkingBranchNameTemplateDesc =
  "String template for branch name that Zephyr Release will use.\n" +
  "Allowed patterns to use are: fixed base string patterns.\n" +
  "Note: This value is immutable at runtime and cannot be changed via stdout config override.\n";

const reviewTitleTemplateSchema = trimNonEmptyStringSchema;
const reviewTitleTemplateDesc =
  "String template for proposal title, using with string patterns like {{ nextVersion }}.\n" +
  "Allowed patterns to use are: all fixed and dynamic string patterns.\n";

const reviewHeaderTemplateSchema = v.string();
const reviewHeaderTemplateDesc =
  "String template for proposal header, using with string patterns like {{ nextVersion }}.\n" +
  "Allowed patterns to use are: all fixed and dynamic string patterns.\n";

const reviewBodyTemplateSchema = v.string();
const reviewBodyTemplateDesc =
  "String template for proposal body, using with string patterns like {{ changelogRelease }}.\n" +
  "Allowed patterns to use are: all fixed and dynamic string patterns.\n";

const reviewFooterTemplateSchema = v.string();
const reviewFooterTemplateDesc =
  "String template for proposal footer, using with string patterns.\n" +
  "Allowed patterns to use are: all fixed and dynamic string patterns.\n";

const reviewConfigDesc =
  'Configuration specific to the "review" release flow. Defines how release proposals (such as PRs, MRs, ...) ' +
  "are generated, formatted, and tracked.";

export const ReviewConfigSchema = v.pipe(
  v.object({
    draft: v.pipe(
      v.optional(reviewDraftSchema, false),
      v.metadata({
        description: reviewDraftDesc + "Default: false",
      }),
    ),

    groupProposals: v.pipe(
      v.optional(reviewGroupProposalsSchema, true),
      v.metadata({
        description: reviewGroupProposalsDesc + "Default: true",
      }),
    ),

    workingBranchNameTemplate: v.pipe(
      v.optional(
        reviewWorkingBranchNameTemplateSchema,
        DEFAULT_WORKING_BRANCH_NAME_TEMPLATE,
      ),
      v.metadata({
        description: reviewWorkingBranchNameTemplateDesc +
          `Default: ${JSON.stringify(DEFAULT_WORKING_BRANCH_NAME_TEMPLATE)}`,
      }),
    ),

    titleTemplate: v.pipe(
      v.optional(reviewTitleTemplateSchema, DEFAULT_PROPOSAL_TITLE_TEMPLATE),
      v.metadata({
        description: reviewTitleTemplateDesc +
          `Default: ${JSON.stringify(DEFAULT_PROPOSAL_TITLE_TEMPLATE)}`,
      }),
    ),
    titleTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing proposal title template. Overrides `titleTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),
    headerTemplate: v.pipe(
      v.optional(reviewHeaderTemplateSchema, DEFAULT_PROPOSAL_HEADER_TEMPLATE),
      v.metadata({
        description: reviewHeaderTemplateDesc +
          `Default: ${JSON.stringify(DEFAULT_PROPOSAL_HEADER_TEMPLATE)}`,
      }),
    ),
    headerTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing proposal header template. Overrides `headerTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),
    bodyTemplate: v.pipe(
      v.optional(reviewBodyTemplateSchema, DEFAULT_PROPOSAL_BODY_TEMPLATE),
      v.metadata({
        description: reviewBodyTemplateDesc +
          `Default: ${JSON.stringify(DEFAULT_PROPOSAL_BODY_TEMPLATE)}`,
      }),
    ),
    bodyTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing proposal body template. Overrides `bodyTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),
    footerTemplate: v.pipe(
      v.optional(reviewFooterTemplateSchema, DEFAULT_PROPOSAL_FOOTER_TEMPLATE),
      v.metadata({
        description: reviewFooterTemplateDesc +
          `Default: ${JSON.stringify(DEFAULT_PROPOSAL_FOOTER_TEMPLATE)}`,
      }),
    ),
    footerTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing proposal footer template. Overrides `footerTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),

    labels: v.pipe(
      v.optional(ReviewLabelsSchema, {}),
      v.metadata({
        description:
          "Labels to attach and remove from proposals on different stages.",
      }),
    ),

    assignees: v.pipe(
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
          "A list of user identifiers to assign to the release proposal.\n" +
          "Use the platform's expected format (e.g., usernames).",
      }),
    ),
    reviewers: v.pipe(
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
          "A list of user or team identifiers requested to review the release proposal.\n" +
          "Use the platform's expected format (e.g., usernames or team slugs).",
      }),
    ),
  }),
  v.metadata({
    description: reviewConfigDesc,
  }),
);

type _ReviewConfigInput = v.InferInput<typeof ReviewConfigSchema>;
export type ReviewConfigOutput = v.InferOutput<typeof ReviewConfigSchema>;

export const ReviewConfigPatchSchema = v.pipe(
  v.object(
    {
      draft: v.pipe(
        v.optional(reviewDraftSchema),
        v.metadata({
          description: reviewDraftDesc + "Default: inherit from root",
        }),
      ),

      groupProposals: v.pipe(
        v.optional(reviewGroupProposalsSchema),
        v.metadata({
          description: reviewGroupProposalsDesc +
            "Default: inherit from root",
        }),
      ),

      workingBranchNameTemplate: v.pipe(
        v.optional(reviewWorkingBranchNameTemplateSchema),
        v.metadata({
          description: reviewWorkingBranchNameTemplateDesc +
            `Default: ${DEFAULT_WORKSPACE_WORKING_BRANCH_NAME_TEMPLATE}`,
        }),
      ),

      titleTemplate: v.pipe(
        v.optional(reviewTitleTemplateSchema),
        v.metadata({
          description: reviewTitleTemplateDesc + "Default: inherit from root",
        }),
      ),
      titleTemplatePath: v.optional(
        v.unwrap(ReviewConfigSchema.entries.titleTemplatePath),
      ),
      headerTemplate: v.pipe(
        v.optional(reviewHeaderTemplateSchema),
        v.metadata({
          description: reviewHeaderTemplateDesc +
            "Default: inherit from root",
        }),
      ),
      headerTemplatePath: v.optional(
        v.unwrap(ReviewConfigSchema.entries.headerTemplatePath),
      ),
      bodyTemplate: v.pipe(
        v.optional(reviewBodyTemplateSchema),
        v.metadata({
          description: reviewBodyTemplateDesc + "Default: inherit from root",
        }),
      ),
      bodyTemplatePath: v.optional(
        v.unwrap(ReviewConfigSchema.entries.bodyTemplatePath),
      ),
      footerTemplate: v.pipe(
        v.optional(reviewFooterTemplateSchema),
        v.metadata({
          description: reviewFooterTemplateDesc +
            "Default: inherit from root",
        }),
      ),
      footerTemplatePath: v.optional(
        v.unwrap(ReviewConfigSchema.entries.footerTemplatePath),
      ),

      labels: v.optional(v.unwrap(ReviewConfigSchema.entries.labels)),

      assignees: v.optional(
        v.unwrap(ReviewConfigSchema.entries.assignees),
      ),
      reviewers: v.optional(
        v.unwrap(ReviewConfigSchema.entries.reviewers),
      ),
    } satisfies Record<keyof ReviewConfigOutput, unknown>,
  ),
  v.metadata({
    description: reviewConfigDesc,
  }),
);

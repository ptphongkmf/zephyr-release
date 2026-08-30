import * as v from "@valibot/valibot";
import { DOCS_EXT_REF_TOKEN } from "../../token.ts";
import {
  DEFAULT_COMMIT_HEADER_TEMPLATE,
} from "../../../constants/defaults/string-templates.ts";
import { trimNonEmptyStringSchema } from "../../string.ts";


const commitConfigDesc = "Configuration specific to commits.";

export const CommitConfigSchema = v.pipe(
  v.object({
    localChangesToCommit: v.pipe(
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
          "Additional local changes to include in the commit (add, modify, or delete files). Accepts a path or an array of paths/globs. " +
          'Paths are relative to the repo root. To include all changes, use a glob such as "**/*".',
        examples: [["some/path"], ["src/release-artifacts/*"], ["**/*"]],
      }),
    ),

    headerTemplate: v.pipe(
      v.optional(trimNonEmptyStringSchema, DEFAULT_COMMIT_HEADER_TEMPLATE),
      v.metadata({
        description:
          "String template for commit header, using with string patterns like {{ nextVersion }}. You can optionally include a " +
          "CI skip token here (or body/footer) to prevent downstream pipeline runs (e.g., `[skip ci]` or `[ci skip]` " +
          "for GitHub, GitLab, and Bitbucket).\n" +
          "Allowed patterns to use are: all fixed and dynamic string patterns.\n" +
          `Default: ${JSON.stringify(DEFAULT_COMMIT_HEADER_TEMPLATE)}`,
      }),
    ),
    headerTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing commit header template. Overrides `headerTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),

    bodyTemplate: v.pipe(
      v.optional(v.string()),
      v.metadata({
        description:
          "String template for commit body, using with string patterns like {{ changelogRelease }}. You can optionally include a " +
          "CI skip token here (or header/footer) to prevent downstream pipeline runs (e.g., `[skip ci]` or `[ci skip]` " +
          "for GitHub, GitLab, and Bitbucket).\n" +
          "Allowed patterns to use are: all fixed and dynamic string patterns.\n",
      }),
    ),
    bodyTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing commit body template. Overrides `bodyTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),

    footerTemplate: v.pipe(
      v.optional(v.string()),
      v.metadata({
        description:
          "String template for commit footer, using with string patterns. You can optionally include a " +
          "CI skip token here (or header/body) to prevent downstream pipeline runs (e.g., `[skip ci]` or `[ci skip]` " +
          "for GitHub, GitLab, and Bitbucket).\n" +
          "Allowed patterns to use are: all fixed and dynamic string patterns.\n",
      }),
    ),
    footerTemplatePath: v.pipe(
      v.optional(trimNonEmptyStringSchema),
      v.metadata({
        description:
          "Path to text file containing commit footer template. Overrides `footerTemplate` when both are provided.\n" +
          `To customize whether this file is fetched locally or remotely, see source mode: ${DOCS_EXT_REF_TOKEN}/docs/input-options.md#source-mode-optional\n` +
          "This path is always relative to the repository root, even in monorepo mode.",
      }),
    ),
  }),
  v.metadata({
    description: commitConfigDesc,
  }),
);

type _CommitConfigInput = v.InferInput<typeof CommitConfigSchema>;
export type CommitConfigOutput = v.InferOutput<typeof CommitConfigSchema>;

export const CommitConfigPatchSchema = v.pipe(
  v.object(
    {
      localChangesToCommit: v.optional(
        v.unwrap(CommitConfigSchema.entries.localChangesToCommit),
      ),

      bodyTemplate: v.optional(
        v.unwrap(CommitConfigSchema.entries.bodyTemplate),
      ),
      bodyTemplatePath: v.optional(
        v.unwrap(CommitConfigSchema.entries.bodyTemplatePath),
      ),
    } satisfies Record<
      keyof Omit<
        CommitConfigOutput,
        | "headerTemplate"
        | "headerTemplatePath"
        | "footerTemplate"
        | "footerTemplatePath"
      >,
      unknown
    >,
  ),
  v.metadata({
    description: commitConfigDesc,
  }),
);

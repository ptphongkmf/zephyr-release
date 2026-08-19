import { taskLogger } from "./logger.ts";
import type { InputsOutput } from "../schemas/inputs/inputs.ts";
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import type { ProviderProposal } from "../types/providers/proposal.ts";
import type { ReviewConfigOutput } from "../schemas/configs/modules/review-config.ts";
import { getTextFile } from "./file.ts";
import { resolveStringTemplate } from "./string-templates-and-patterns/resolve-template.ts";
import type { StringPatternContext } from "./string-templates-and-patterns/pattern-context.ts";
import { PROPOSAL_MARKERS } from "../constants/markers.ts";

type FindProposalInputsParams = Pick<
  InputsOutput,
  "triggerCommitHash" | "triggerBranchName"
>;

/** @throws */
export async function findMergedProposalByCommit(
  provider: PlatformProvider,
  workingBranchName: string,
  inputs: FindProposalInputsParams,
): Promise<ProviderProposal | undefined> {
  const { triggerCommitHash, triggerBranchName } = inputs;

  const foundProposal = await provider.findMergedProposalByCommit(
    triggerCommitHash,
    workingBranchName,
    triggerBranchName,
  );

  taskLogger.debug(
    `Found associated merged proposal for trigger commit (${triggerCommitHash}):\n` +
      JSON.stringify(foundProposal, null, 2),
  );

  return foundProposal;
}

/** @throws */
export async function findOpenProposal(
  provider: PlatformProvider,
  workingBranchName: string,
  inputs: FindProposalInputsParams,
): Promise<ProviderProposal | undefined> {
  const { triggerBranchName } = inputs;

  const foundProposal = await provider.findOpenProposal(
    workingBranchName,
    triggerBranchName,
  );

  taskLogger.debug(
    `Found associated open proposal for branch "${triggerBranchName}":\n` +
      JSON.stringify(foundProposal, null, 2),
  );

  return foundProposal;
}

interface CreateProposalContentConfigParams {
  review: Pick<
    ReviewConfigOutput,
    | "headerTemplate"
    | "headerTemplatePath"
    | "bodyTemplate"
    | "bodyTemplatePath"
    | "footerTemplate"
    | "footerTemplatePath"
  >;
}

export async function createProposalContent(
  provider: PlatformProvider,
  inputs: Pick<
    InputsOutput,
    "triggerCommitHash" | "sourceMode" | "workspacePath"
  >,
  config: CreateProposalContentConfigParams,
  patternContext: StringPatternContext,
): Promise<string> {
  const {
    headerTemplate,
    headerTemplatePath,
    bodyTemplate,
    bodyTemplatePath,
    footerTemplate,
    footerTemplatePath,
  } = config.review;
  const { triggerCommitHash, sourceMode, workspacePath } = inputs;

  let proposalHeader: string;
  if (headerTemplatePath) {
    const proposalHeaderTemplate = await getTextFile(
      sourceMode.overrides?.[headerTemplatePath] ?? sourceMode.mode,
      headerTemplatePath,
      { provider, workspacePath: workspacePath, ref: triggerCommitHash },
    );
    proposalHeader = await resolveStringTemplate(proposalHeaderTemplate, patternContext);
  } else {
    proposalHeader = await resolveStringTemplate(headerTemplate, patternContext);
  }

  let proposalBody: string;
  if (bodyTemplatePath) {
    const proposalBodyTemplate = await getTextFile(
      sourceMode.overrides?.[bodyTemplatePath] ?? sourceMode.mode,
      bodyTemplatePath,
      { provider, workspacePath: workspacePath, ref: triggerCommitHash },
    );
    proposalBody = await resolveStringTemplate(proposalBodyTemplate, patternContext);
  } else {
    proposalBody = await resolveStringTemplate(bodyTemplate, patternContext);
  }
  const proposalBodyWithMarkers = [
    PROPOSAL_MARKERS.bodyStart,
    proposalBody,
    PROPOSAL_MARKERS.bodyEnd,
  ]
    .join("\n");

  let proposalFooter: string;
  if (footerTemplatePath) {
    const proposalFooterTemplate = await getTextFile(
      sourceMode.overrides?.[footerTemplatePath] ?? sourceMode.mode,
      footerTemplatePath,
      { provider, workspacePath: workspacePath, ref: triggerCommitHash },
    );
    proposalFooter = await resolveStringTemplate(proposalFooterTemplate, patternContext);
  } else {
    proposalFooter = await resolveStringTemplate(footerTemplate, patternContext);
  }

  return [proposalHeader, proposalBodyWithMarkers, proposalFooter].filter(
    Boolean,
  ).join("\n\n");
}

interface CreateOrUpdateProposalConfigParams {
  review: Pick<
    ReviewConfigOutput,
    | "draft"
    | "titleTemplate"
    | "titleTemplatePath"
    | "headerTemplate"
    | "headerTemplatePath"
    | "bodyTemplate"
    | "bodyTemplatePath"
    | "footerTemplate"
    | "footerTemplatePath"
  >;
}

/** @throws */
export async function createOrUpdateProposal(
  provider: PlatformProvider,
  proposalData: {
    workingBranchName: string;
    triggerBranchName: string;
    associatedProposalFromBranch: ProviderProposal | undefined;
  },
  inputs: Pick<
    InputsOutput,
    "triggerCommitHash" | "workspacePath" | "sourceMode"
  >,
  config: CreateOrUpdateProposalConfigParams,
  patternContext: StringPatternContext,
): Promise<ProviderProposal> {
  const {
    workingBranchName,
    triggerBranchName,
    associatedProposalFromBranch,
  } = proposalData;
  const { draft, titleTemplate } = config.review;

  const proposalTitle = await resolveStringTemplate(titleTemplate, patternContext);
  const proposalContent = await createProposalContent(
    provider,
    inputs,
    config,
    patternContext,
  );

  let proposal: ProviderProposal;
  if (associatedProposalFromBranch) {
    taskLogger.info("Updating current working proposal...");
    proposal = await provider.updateProposal(
      associatedProposalFromBranch.id,
      proposalTitle,
      proposalContent,
    );
  } else {
    taskLogger.info("Creating new working proposal...");
    proposal = await provider.createProposal(
      workingBranchName,
      triggerBranchName,
      proposalTitle,
      proposalContent,
      { draft },
    );
  }

  return proposal;
}

export function extractChangelogFromProposal(
  mergedProposal: ProviderProposal,
): string | undefined {
  const changelogReleaseStartIndex = mergedProposal.body.indexOf(
    PROPOSAL_MARKERS.bodyStart,
  );
  const changelogReleaseEndIndex = mergedProposal.body.lastIndexOf(
    PROPOSAL_MARKERS.bodyEnd,
  );

  if (changelogReleaseStartIndex === -1 || changelogReleaseEndIndex === -1) {
    return undefined;
  }

  const changelogRelease = mergedProposal.body.substring(
    changelogReleaseStartIndex + PROPOSAL_MARKERS.bodyStart.length,
    changelogReleaseEndIndex,
  ).trim();
  taskLogger.info(
    "Extracted changelog release from merged proposal body: " +
      changelogRelease,
  );

  return changelogRelease;
}

export async function addAssigneesToProposal(
  provider: PlatformProvider,
  proposalId: string,
  assignees: string[],
) {
  try {
    const addResult = await provider.addAssigneesToProposal(
      proposalId,
      assignees,
    );

    if (addResult.length === 0) {
      taskLogger.warn(
        "Failed to add any assignees. Ensure the provided usernames are valid and have repository permissions",
      );
      return;
    }

    const missedAssignees = assignees.filter((a) =>
      !addResult.some((added) =>
        added.username.toLowerCase() === a.toLowerCase()
      )
    );

    if (missedAssignees.length > 0) {
      taskLogger.warn(
        `Successfully assigned: ${
          addResult.map((r) => r.username).join(", ")
        }. ` +
          `Skipped (invalid or unauthorized): ${missedAssignees.join(", ")}.`,
      );
    } else {
      taskLogger.info(
        `Successfully added all assignees: ${
          addResult.map((r) => r.username).join(", ")
        }.`,
      );
    }
  } catch (error) {
    taskLogger.warn(
      `Failed to add assignees to proposal. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export async function addReviewersToProposal(
  provider: PlatformProvider,
  proposalId: string,
  reviewers: string[],
) {
  try {
    await provider.addReviewersToProposal(
      proposalId,
      reviewers,
    );

    taskLogger.info(
      `Successfully requested reviews from: ${reviewers.join(", ")}`,
    );
  } catch (error) {
    taskLogger.warn(
      `Failed to request reviewers. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

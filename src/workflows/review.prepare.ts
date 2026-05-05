import { logger } from "../tasks/logger.ts";
import {
  commitChangesToBranch,
  prepareChangesToCommit,
  resolveCommitsFromTriggerToLastRelease,
} from "../tasks/commit.ts";
import {
  addAssigneesToProposal,
  addReviewersToProposal,
  createOrUpdateProposal,
} from "../tasks/proposal.ts";
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import {
  calculateNextVersion,
  compareNextVersionToCurrentVersion,
} from "../tasks/calculate-next-version/calculate-version.ts";
import { getCurrentVersion } from "../tasks/calculate-next-version/previous-version.ts";
import {
  createDynamicChangelogStringPatternContext,
  createFixedCurrentVersionStringPatternContext,
  createFixedNextVersionStringPatternContext,
  createFixedTagStringPatternContext,
} from "../tasks/string-templates-and-patterns/pattern-context.ts";
import { generatePrepareChangelogReleaseContent } from "../tasks/changelog.ts";
import { runCommands } from "../tasks/command.ts";
import {
  exportPostPrepareOperationVariables,
  exportPrePrepareOperationVariables,
} from "../tasks/export-variables.ts";
import type { OperationRunSettings } from "../types/operation-context.ts";
import { addLabelsToProposalOnCreate } from "../tasks/label.ts";
import type { BootstrapResult } from "./bootstrap.ts";
import {
  resolveRuntimeConfigOverride,
  synchronizeRuntimeStateAfterOverride,
} from "../tasks/runtime-override.ts";

export async function executeReviewPreparePhase(
  provider: PlatformProvider,
  currentRunSettings: OperationRunSettings,
  bootstrapData: BootstrapResult,
): Promise<OperationRunSettings> {
  const {
    workingBranchResult,
    associatedProposalFromBranch,
    triggerContext,
  } = bootstrapData;

  /**
   * Prepare phase run settings.
   */
  let runSettings: OperationRunSettings = currentRunSettings;

  logger.stepStart("Starting: Get current version");
  const currentVersion = await getCurrentVersion(
    provider,
    runSettings.inputs,
    runSettings.config,
  );
  logger.stepFinish("Finished: Get current version");

  logger.stepStart("Starting: Resolve commits from trigger to last release");
  const resolvedCommitsResult = await resolveCommitsFromTriggerToLastRelease(
    provider,
    runSettings.inputs,
    runSettings.config,
  );
  logger.stepFinish("Finished: Resolve commits from trigger to last release");

  logger.stepStart("Starting: Calculate next version");
  const nextVersion = calculateNextVersion(
    resolvedCommitsResult,
    runSettings.config,
    currentVersion,
  );
  logger.stepFinish("Finished: Calculate next version");

  logger.stepStart(
    "Starting: Compare calculated next version with current version",
  );
  compareNextVersionToCurrentVersion(
    nextVersion,
    currentVersion,
  );
  logger.stepFinish(
    "Finished: Compare calculated next version with current version",
  );

  logger.debugStepStart(
    "Starting: Create fixed current version, next version and tag string pattern context",
  );
  createFixedCurrentVersionStringPatternContext(currentVersion);
  createFixedNextVersionStringPatternContext(nextVersion);
  await createFixedTagStringPatternContext(
    runSettings.config.tag.nameTemplate,
  );
  logger.debugStepFinish(
    "Finished: Create fixed current version, next version and tag string pattern context",
  );

  logger.debugStepStart("Starting: Export pre prepare operation variables");
  await exportPrePrepareOperationVariables(
    provider,
    resolvedCommitsResult.entries,
    currentVersion,
    nextVersion,
  );
  logger.debugStepFinish("Finished: Export pre prepare operation variables");

  logger.stepStart("Starting: Execute prepare pre commands");
  const preResult = await runCommands(
    runSettings.config.commandHooks.prepare,
    "pre",
  );
  if (preResult) {
    logger.stepFinish(
      `Finished: Execute prepare pre commands. ${preResult}`,
    );
  } else {
    logger.stepSkip("Skipped: Execute prepare pre commands (empty)");
  }

  logger.stepStart(
    "Starting: Resolve runtime config override (prepare pre commands)",
  );
  const _preparePreRuntimeConfigResult = await resolveRuntimeConfigOverride(
    runSettings.rawConfig,
    runSettings.config,
    runSettings.inputs.workspacePath,
  );
  if (_preparePreRuntimeConfigResult) {
    runSettings = {
      ...runSettings,
      rawConfig: _preparePreRuntimeConfigResult.rawResolvedRuntime,
      config: _preparePreRuntimeConfigResult.resolvedRuntime,
    };
    await synchronizeRuntimeStateAfterOverride({
      provider,
      config: runSettings.config,
      rawConfig: runSettings.rawConfig,
      triggerBranchName: runSettings.inputs.triggerBranchName,
      nextVersion,
      currentVersion,
    });
    logger.stepFinish(
      "Finished: Resolve runtime config override (prepare pre commands)",
    );
  } else {
    logger.stepSkip(
      "Skipped: Resolve runtime config override (prepare pre commands)",
    );
  }

  logger.stepStart("Starting: Generate changelog release content");
  const changelogReleaseResult = await generatePrepareChangelogReleaseContent(
    provider,
    resolvedCommitsResult.entries,
    runSettings.inputs,
    runSettings.config,
  );
  logger.stepFinish("Finished: Generate changelog release content");

  logger.debugStepStart(
    "Starting: Create dynamic changelog string pattern context",
  );
  createDynamicChangelogStringPatternContext(
    changelogReleaseResult.release,
    changelogReleaseResult.releaseBody,
    changelogReleaseResult.releaseAlt,
    changelogReleaseResult.releaseBodyAlt,
  );
  logger.debugStepFinish(
    "Finished: Create dynamic changelog string pattern context",
  );

  logger.stepStart("Starting: Prepare and collect changes data to commit");
  const changesData = await prepareChangesToCommit(
    provider,
    runSettings.inputs,
    runSettings.config,
    nextVersion,
  );
  logger.stepFinish("Finished: Prepare and collect changes data to commit");

  logger.stepStart("Starting: Commit changes");
  const commitResult = await commitChangesToBranch(
    provider,
    runSettings.inputs,
    runSettings.config,
    {
      baseTreeHash: triggerContext.latestTriggerCommit.treeHash,
      changesToCommit: changesData,
      targetBranchName: workingBranchResult.name,
      force: true,
    },
  );
  logger.stepFinish("Finished: Commit changes");

  logger.stepStart("Starting: Create or update proposal");
  const proposal = await createOrUpdateProposal(
    provider,
    {
      workingBranchName: workingBranchResult.name,
      triggerBranchName: runSettings.inputs.triggerBranchName,
      associatedProposalFromBranch,
    },
    runSettings.inputs,
    runSettings.config,
  );
  logger.stepFinish("Finished: Create or update proposal");

  if (runSettings.config.review.labels?.onCreate) {
    logger.stepStart("Starting: Add labels to proposal");
    await addLabelsToProposalOnCreate(
      provider,
      proposal.id,
      runSettings.config.review.labels.onCreate,
    );
    logger.stepFinish("Finished: Add labels to proposal");
  }

  if (runSettings.config.review.assignees) {
    logger.stepStart("Starting: Add assignees to proposal");
    await addAssigneesToProposal(
      provider,
      proposal.id,
      runSettings.config.review.assignees,
    );
    logger.stepFinish("Finished: Add assignees to proposal");
  }

  if (runSettings.config.review.reviewers) {
    logger.stepStart("Starting: Add reviewers to proposal");
    await addReviewersToProposal(
      provider,
      proposal.id,
      runSettings.config.review.reviewers,
    );
    logger.stepFinish("Finished: Add reviewers to proposal");
  }

  logger.debugStepStart("Starting: Export post prepare operation variables");
  await exportPostPrepareOperationVariables(
    provider,
    commitResult.hash,
    changesData,
    {
      proposalId: proposal.id,
    },
  );
  logger.debugStepFinish("Finished: Export post prepare operation variables");

  logger.stepStart("Starting: Execute prepare post commands");
  const postResult = await runCommands(
    runSettings.config.commandHooks.prepare,
    "post",
  );
  if (postResult) {
    logger.stepFinish(
      `Finished: Execute prepare post commands. ${postResult}`,
    );
  } else {
    logger.stepSkip("Skipped: Execute prepare post commands (empty)");
  }

  logger.stepStart(
    "Starting: Resolve runtime config override (prepare post commands)",
  );
  const _preparePostRuntimeConfigResult = await resolveRuntimeConfigOverride(
    runSettings.rawConfig,
    runSettings.config,
    runSettings.inputs.workspacePath,
  );
  if (_preparePostRuntimeConfigResult) {
    runSettings = {
      ...runSettings,
      rawConfig: _preparePostRuntimeConfigResult.rawResolvedRuntime,
      config: _preparePostRuntimeConfigResult.resolvedRuntime,
    };
    await synchronizeRuntimeStateAfterOverride({
      provider,
      config: runSettings.config,
      rawConfig: runSettings.rawConfig,
      triggerBranchName: runSettings.inputs.triggerBranchName,
      nextVersion,
      currentVersion,
    });
    logger.stepFinish(
      "Finished: Resolve runtime config override (prepare post commands)",
    );
  } else {
    logger.stepSkip(
      "Skipped: Resolve runtime config override (prepare post commands)",
    );
  }

  return runSettings;
}

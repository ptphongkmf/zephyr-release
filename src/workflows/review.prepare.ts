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
import { format } from "@std/semver";
import {
  addChangelogPatternContext,
  addCurrentVersionPatternContext,
  addNextVersionPatternContext,
  addReleasesPatternContext,
  addTagPatternContext,
} from "../tasks/string-templates-and-patterns/pattern-context.ts";
import { generatePrepareChangelogReleaseContent } from "../tasks/changelog.ts";
import { runCommands } from "../tasks/command.ts";
import {
  exportPostCalculateVersionVariables,
  exportPostCommitVariables,
  exportPostProposalVariables,
  exportPreCalculateVersionVariables,
  exportPreCommitVariables,
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
    patternContext: initialPatternContext,
  } = bootstrapData;

  let patternContext = initialPatternContext;

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

  // preCalculateVersion hook
  // Commits are parsed, version is NOT calculated yet.
  logger.debugStepStart("Starting: Export pre calculate version variables");
  await exportPreCalculateVersionVariables(
    provider,
    resolvedCommitsResult.entries,
    patternContext,
  );
  logger.debugStepFinish("Finished: Export pre calculate version variables");

  logger.stepStart("Starting: Execute pre calculate version commands");
  const preCalculateVersionResult = await runCommands(
    runSettings.config.commandHooks,
    "preCalculateVersion",
  );
  if (preCalculateVersionResult) {
    logger.stepFinish(
      `Finished: Execute pre calculate version commands. ${preCalculateVersionResult}`,
    );
  } else {
    logger.stepSkip("Skipped: Execute pre calculate version commands (empty)");
  }

  logger.stepStart(
    "Starting: Resolve runtime config override (pre calculate version commands)",
  );
  const _preCalculateVersionRuntimeConfigResult =
    await resolveRuntimeConfigOverride(
      runSettings.rawConfig,
      runSettings.config,
      runSettings.inputs.workspacePath,
    );
  if (_preCalculateVersionRuntimeConfigResult) {
    runSettings = {
      ...runSettings,
      rawConfig: _preCalculateVersionRuntimeConfigResult.rawResolvedRuntime,
      config: _preCalculateVersionRuntimeConfigResult.resolvedRuntime,
    };
    patternContext = await synchronizeRuntimeStateAfterOverride({
      provider,
      config: runSettings.config,
      rawConfig: runSettings.rawConfig,
      triggerBranchName: runSettings.inputs.triggerBranchName,
      currentPatternContext: patternContext,
    });
    logger.stepFinish(
      "Finished: Resolve runtime config override (pre calculate version commands)",
    );
  } else {
    logger.stepSkip(
      "Skipped: Resolve runtime config override (pre calculate version commands)",
    );
  }

  // Calculate version
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
  if (currentVersion) {
    patternContext = addCurrentVersionPatternContext(
      patternContext,
      currentVersion,
    );
  }
  patternContext = addNextVersionPatternContext(patternContext, nextVersion);
  patternContext = await addTagPatternContext(
    patternContext,
    runSettings.config.tag.nameTemplate,
  );

  patternContext = addReleasesPatternContext(patternContext, [{
    name: runSettings.config.name ?? "root",
    nextVersion: format(nextVersion),
    tagName: patternContext.tagName as string,
    isWorkspace: false,
  }]);
  logger.debugStepFinish(
    "Finished: Create fixed current version, next version and tag string pattern context",
  );

  // postCalculateVersion hook
  // Version is locked in, no files modified yet.
  logger.debugStepStart("Starting: Export post calculate version variables");
  await exportPostCalculateVersionVariables(
    provider,
    currentVersion,
    nextVersion,
    patternContext,
  );
  logger.debugStepFinish("Finished: Export post calculate version variables");

  logger.stepStart("Starting: Execute post calculate version commands");
  const postCalculateVersionResult = await runCommands(
    runSettings.config.commandHooks,
    "postCalculateVersion",
  );
  if (postCalculateVersionResult) {
    logger.stepFinish(
      `Finished: Execute post calculate version commands. ${postCalculateVersionResult}`,
    );
  } else {
    logger.stepSkip("Skipped: Execute post calculate version commands (empty)");
  }

  logger.stepStart(
    "Starting: Resolve runtime config override (post calculate version commands)",
  );
  const _postCalculateVersionRuntimeConfigResult =
    await resolveRuntimeConfigOverride(
      runSettings.rawConfig,
      runSettings.config,
      runSettings.inputs.workspacePath,
    );
  if (_postCalculateVersionRuntimeConfigResult) {
    runSettings = {
      ...runSettings,
      rawConfig: _postCalculateVersionRuntimeConfigResult.rawResolvedRuntime,
      config: _postCalculateVersionRuntimeConfigResult.resolvedRuntime,
    };
    patternContext = await synchronizeRuntimeStateAfterOverride({
      provider,
      config: runSettings.config,
      rawConfig: runSettings.rawConfig,
      triggerBranchName: runSettings.inputs.triggerBranchName,
      currentPatternContext: patternContext,
      nextVersion,
      currentVersion,
    });
    logger.stepFinish(
      "Finished: Resolve runtime config override (post calculate version commands)",
    );
  } else {
    logger.stepSkip(
      "Skipped: Resolve runtime config override (post calculate version commands)",
    );
  }

  // Generate changelog and prepare changes
  logger.stepStart("Starting: Generate changelog release content");
  const changelogReleaseResult = await generatePrepareChangelogReleaseContent(
    provider,
    resolvedCommitsResult.entries,
    runSettings.inputs,
    runSettings.config,
    patternContext,
  );
  logger.stepFinish("Finished: Generate changelog release content");

  logger.debugStepStart(
    "Starting: Create dynamic changelog string pattern context",
  );
  patternContext = addChangelogPatternContext(
    patternContext,
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
    patternContext,
  );
  logger.stepFinish("Finished: Prepare and collect changes data to commit");

  // preCommit hook
  // Files are written to disk, git commit has NOT executed yet.
  logger.debugStepStart("Starting: Export pre commit variables");
  await exportPreCommitVariables(provider, changesData, patternContext);
  logger.debugStepFinish("Finished: Export pre commit variables");

  logger.stepStart("Starting: Execute pre commit commands");
  const preCommitResult = await runCommands(
    runSettings.config.commandHooks,
    "preCommit",
  );
  if (preCommitResult) {
    logger.stepFinish(
      `Finished: Execute pre commit commands. ${preCommitResult}`,
    );
  } else {
    logger.stepSkip("Skipped: Execute pre commit commands (empty)");
  }

  logger.stepStart(
    "Starting: Resolve runtime config override (pre commit commands)",
  );
  const _preCommitRuntimeConfigResult = await resolveRuntimeConfigOverride(
    runSettings.rawConfig,
    runSettings.config,
    runSettings.inputs.workspacePath,
  );
  if (_preCommitRuntimeConfigResult) {
    runSettings = {
      ...runSettings,
      rawConfig: _preCommitRuntimeConfigResult.rawResolvedRuntime,
      config: _preCommitRuntimeConfigResult.resolvedRuntime,
    };
    patternContext = await synchronizeRuntimeStateAfterOverride({
      provider,
      config: runSettings.config,
      rawConfig: runSettings.rawConfig,
      triggerBranchName: runSettings.inputs.triggerBranchName,
      currentPatternContext: patternContext,
      nextVersion,
      currentVersion,
    });
    logger.stepFinish(
      "Finished: Resolve runtime config override (pre commit commands)",
    );
  } else {
    logger.stepSkip(
      "Skipped: Resolve runtime config override (pre commit commands)",
    );
  }

  // Commit
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
    patternContext,
  );
  logger.stepFinish("Finished: Commit changes");

  // postCommit hook
  // Changes are committed and pushed.
  logger.debugStepStart("Starting: Export post commit variables");
  await exportPostCommitVariables(provider, commitResult.hash, patternContext);
  logger.debugStepFinish("Finished: Export post commit variables");

  logger.stepStart("Starting: Execute post commit commands");
  const postCommitResult = await runCommands(
    runSettings.config.commandHooks,
    "postCommit",
  );
  if (postCommitResult) {
    logger.stepFinish(
      `Finished: Execute post commit commands. ${postCommitResult}`,
    );
  } else {
    logger.stepSkip("Skipped: Execute post commit commands (empty)");
  }

  logger.stepStart(
    "Starting: Resolve runtime config override (post commit commands)",
  );
  const _postCommitRuntimeConfigResult = await resolveRuntimeConfigOverride(
    runSettings.rawConfig,
    runSettings.config,
    runSettings.inputs.workspacePath,
  );
  if (_postCommitRuntimeConfigResult) {
    runSettings = {
      ...runSettings,
      rawConfig: _postCommitRuntimeConfigResult.rawResolvedRuntime,
      config: _postCommitRuntimeConfigResult.resolvedRuntime,
    };
    patternContext = await synchronizeRuntimeStateAfterOverride({
      provider,
      config: runSettings.config,
      rawConfig: runSettings.rawConfig,
      triggerBranchName: runSettings.inputs.triggerBranchName,
      currentPatternContext: patternContext,
      nextVersion,
      currentVersion,
    });
    logger.stepFinish(
      "Finished: Resolve runtime config override (post commit commands)",
    );
  } else {
    logger.stepSkip(
      "Skipped: Resolve runtime config override (post commit commands)",
    );
  }

  // Create/Update Proposal
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
    patternContext,
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

  // postProposal hook
  // Proposal is created/updated.
  logger.debugStepStart("Starting: Export post proposal variables");
  await exportPostProposalVariables(
    provider,
    proposal.id,
    undefined,
    patternContext,
  );
  logger.debugStepFinish("Finished: Export post proposal variables");

  logger.stepStart("Starting: Execute post proposal commands");
  const postProposalResult = await runCommands(
    runSettings.config.commandHooks,
    "postProposal",
  );
  if (postProposalResult) {
    logger.stepFinish(
      `Finished: Execute post proposal commands. ${postProposalResult}`,
    );
  } else {
    logger.stepSkip("Skipped: Execute post proposal commands (empty)");
  }

  logger.stepStart(
    "Starting: Resolve runtime config override (post proposal commands)",
  );
  const _postProposalRuntimeConfigResult = await resolveRuntimeConfigOverride(
    runSettings.rawConfig,
    runSettings.config,
    runSettings.inputs.workspacePath,
  );
  if (_postProposalRuntimeConfigResult) {
    runSettings = {
      ...runSettings,
      rawConfig: _postProposalRuntimeConfigResult.rawResolvedRuntime,
      config: _postProposalRuntimeConfigResult.resolvedRuntime,
    };
    patternContext = await synchronizeRuntimeStateAfterOverride({
      provider,
      config: runSettings.config,
      rawConfig: runSettings.rawConfig,
      triggerBranchName: runSettings.inputs.triggerBranchName,
      currentPatternContext: patternContext,
      nextVersion,
      currentVersion,
    });
    logger.stepFinish(
      "Finished: Resolve runtime config override (post proposal commands)",
    );
  } else {
    logger.stepSkip(
      "Skipped: Resolve runtime config override (post proposal commands)",
    );
  }

  return runSettings;
}

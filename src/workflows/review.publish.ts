import { generatePublishChangelogReleaseContent } from "../tasks/changelog.ts";
import { runCommands } from "../tasks/command.ts";
import {
  exportPostPublishOperationVariables,
  exportPrePublishOperationVariables,
} from "../tasks/export-variables.ts";
import { updateProposalLabelsOnMerge } from "../tasks/label.ts";
import { logger } from "../tasks/logger.ts";
import { extractChangelogFromProposal } from "../tasks/proposal.ts";
import { attachReleaseAssets, createRelease } from "../tasks/release.ts";
import {
  resolveRuntimeConfigOverride,
  synchronizeRuntimeStateAfterOverride,
} from "../tasks/runtime-override.ts";
import {
  createDynamicChangelogStringPatternContext,
  createFixedNextVersionStringPatternContext,
  createFixedTagStringPatternContext,
} from "../tasks/string-templates-and-patterns/pattern-context.ts";
import { createTag } from "../tasks/tag.ts";
import {
  getPrimaryVersionFile,
  getVersionSemVerFromVersionFile,
} from "../tasks/version-files/version-file.ts";
import type { OperationRunSettings } from "../types/operation-context.ts";
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import type { ProviderProposal } from "../types/providers/proposal.ts";
import type { ProviderRelease } from "../types/providers/release.ts";

export async function executeReviewPublishPhase(
  provider: PlatformProvider,
  currentRunSettings: OperationRunSettings,
  associatedProposalForCommit: ProviderProposal,
): Promise<OperationRunSettings> {
  /**
   * Publish phase run settings.
   */
  let runSettings: OperationRunSettings = currentRunSettings;

  logger.stepStart("Starting: Generate changelog release content");
  const proposalChangelogRelease = extractChangelogFromProposal(
    associatedProposalForCommit,
  );
  const changelogReleaseResult = await generatePublishChangelogReleaseContent(
    provider,
    proposalChangelogRelease ?? "",
    runSettings.inputs,
    runSettings.config,
  );
  logger.stepFinish("Finished: Generate changelog release content");

  logger.stepStart("Starting: Extract next version from primary version file");
  const primaryVersionFile = getPrimaryVersionFile(
    runSettings.config.versionFiles,
  );
  const nextVersion = await getVersionSemVerFromVersionFile(
    primaryVersionFile,
    runSettings.inputs.sourceMode,
    provider,
    runSettings.inputs.workspacePath,
    runSettings.inputs.triggerCommitHash,
  );
  if (!nextVersion) {
    throw new Error("Failed to extract next version from primary version file");
  }
  logger.stepFinish(
    "Finished: Extract next version from primary version file",
  );

  logger.debugStepStart(
    "Starting: Create fixed next version and tag string pattern context",
  );
  createFixedNextVersionStringPatternContext(nextVersion);
  await createFixedTagStringPatternContext(
    runSettings.config.tag.nameTemplate,
  );
  logger.debugStepFinish(
    "Finished: Create fixed next version and tag string pattern context",
  );

  logger.debugStepStart(
    "Starting: Create dynamic changelog string pattern contextt",
  );
  createDynamicChangelogStringPatternContext(
    changelogReleaseResult?.release,
    changelogReleaseResult?.releaseBody,
    changelogReleaseResult?.releaseAlt,
    changelogReleaseResult?.releaseBodyAlt,
  );
  logger.debugStepFinish(
    "Finished: Create dynamic changelog string pattern contextt",
  );

  logger.debugStepStart("Starting: Export pre publish operation variables");
  await exportPrePublishOperationVariables(
    provider,
    nextVersion,
    associatedProposalForCommit.id,
  );
  logger.debugStepFinish("Finished: Export pre publish operation variables");

  logger.stepStart("Starting: Execute publish pre commands");
  const preResult = await runCommands(
    runSettings.config.commandHooks.publish,
    "pre",
  );
  if (preResult) {
    logger.stepFinish(
      `Finished: Execute publish pre commands. ${preResult}`,
    );
  } else {
    logger.stepSkip("Skipped: Execute publish pre commands (empty)");
  }

  logger.stepStart(
    "Starting: Resolve runtime config override (publish pre commands)",
  );
  const _releasePreRuntimeConfigResult = await resolveRuntimeConfigOverride(
    runSettings.rawConfig,
    runSettings.config,
    runSettings.inputs.workspacePath,
  );
  if (_releasePreRuntimeConfigResult) {
    runSettings = {
      ...runSettings,
      rawConfig: _releasePreRuntimeConfigResult.rawResolvedRuntime,
      config: _releasePreRuntimeConfigResult.resolvedRuntime,
    };
    await synchronizeRuntimeStateAfterOverride({
      provider,
      config: runSettings.config,
      rawConfig: runSettings.rawConfig,
      triggerBranchName: runSettings.inputs.triggerBranchName,
      nextVersion,
    });
    logger.stepFinish(
      "Finished: Resolve runtime config override (publish pre commands)",
    );
  } else {
    logger.stepSkip(
      "Skipped: Resolve runtime config override (publish pre commands)",
    );
  }

  logger.stepStart("Starting: Create tag");
  const createdTag = await createTag(
    provider,
    runSettings.inputs.triggerCommitHash,
    runSettings.inputs,
    runSettings.config,
  );
  logger.stepFinish("Finished: Create tag");

  logger.stepStart("Starting: Create release");
  let createdReleaseNote: ProviderRelease | undefined;
  if (runSettings.config.release.createRelease) {
    createdReleaseNote = await createRelease(
      provider,
      runSettings.inputs,
      runSettings.config,
    );
    logger.stepFinish("Finished: Create release");
  } else {
    logger.stepSkip(
      "Skipped: Create release (config create release note is false)",
    );
  }

  logger.stepStart("Starting: Attach release assets");
  if (createdReleaseNote?.id && runSettings.config.release.assets) {
    await attachReleaseAssets(
      provider,
      createdReleaseNote.id,
      runSettings.config.release.assets,
    );
    logger.stepFinish("Finished: Attach release assets");
  } else {
    logger.stepSkip(
      "Skipped: Attach release assets (no assets to attach or config create release note is false)",
    );
  }

  logger.stepStart("Starting: Update merged proposal labels");
  await updateProposalLabelsOnMerge(
    provider,
    associatedProposalForCommit.id,
    runSettings.config.review.labels?.onMerge?.add,
    runSettings.config.review.labels?.onMerge?.remove,
  );
  logger.stepFinish("Finished: Update merged proposal labels");

  logger.debugStepStart("Starting: Export post publish operation variables");
  await exportPostPublishOperationVariables(
    provider,
    createdTag.hash,
    createdReleaseNote?.id,
    createdReleaseNote?.uploadUrl,
  );
  logger.debugStepFinish("Finished: Export post publish operation variables");

  logger.stepStart("Starting: Execute publish post commands");
  const postResult = await runCommands(
    runSettings.config.commandHooks.publish,
    "post",
  );
  if (postResult) {
    logger.stepFinish(
      `Finished: Execute publish post commands. ${postResult}`,
    );
  } else {
    logger.stepSkip("Skipped: Execute publish post commands (empty)");
  }

  logger.stepStart(
    "Starting: Resolve runtime config override (publish post commands)",
  );
  const _releasePostRuntimeConfigResult = await resolveRuntimeConfigOverride(
    runSettings.rawConfig,
    runSettings.config,
    runSettings.inputs.workspacePath,
  );
  if (_releasePostRuntimeConfigResult) {
    runSettings = {
      ...runSettings,
      rawConfig: _releasePostRuntimeConfigResult.rawResolvedRuntime,
      config: _releasePostRuntimeConfigResult.resolvedRuntime,
    };
    await synchronizeRuntimeStateAfterOverride({
      provider,
      config: runSettings.config,
      rawConfig: runSettings.rawConfig,
      triggerBranchName: runSettings.inputs.triggerBranchName,
      nextVersion,
    });
    logger.stepFinish(
      "Finished: Resolve runtime config override (publish post commands)",
    );
  } else {
    logger.stepSkip(
      "Skipped: Resolve runtime config override (publish post commands)",
    );
  }

  return runSettings;
}

import type { WorkingBranchResult } from "../tasks/branch.ts";
import {
  calculateNextVersion,
  compareNextVersionToCurrentVersion,
} from "../tasks/calculate-next-version/calculate-version.ts";
import { getCurrentVersion } from "../tasks/calculate-next-version/previous-version.ts";
import { generatePrepareChangelogReleaseContent } from "../tasks/changelog.ts";
import { runCommands } from "../tasks/command.ts";
import {
  commitChangesToBranch,
  prepareChangesToCommit,
  resolveCommitsFromTriggerToLastRelease,
} from "../tasks/commit.ts";
import {
  exportPostPrepareOperationVariables,
  exportPostPublishOperationVariables,
  exportPrePrepareOperationVariables,
  exportPrePublishOperationVariables,
} from "../tasks/export-variables.ts";
import { logger } from "../tasks/logger.ts";
import {
  createDynamicChangelogStringPatternContext,
  createFixedCurrentVersionStringPatternContext,
  createFixedNextVersionStringPatternContext,
  createFixedTagStringPatternContext,
} from "../tasks/string-templates-and-patterns/pattern-context.ts";
import type {
  OperationRunSettings,
  OperationTriggerContext,
} from "../types/operation-context.ts";
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import type { ProviderProposal } from "../types/providers/proposal.ts";
import { evaluateAutoModeTriggerStrategy } from "../tasks/auto-trigger-strategy.ts";
import { createTag } from "../tasks/tag.ts";
import { attachReleaseAssets, createRelease } from "../tasks/release.ts";
import type { ProviderRelease } from "../types/providers/release.ts";
import {
  resolveRuntimeConfigOverride,
  synchronizeRuntimeStateAfterOverride,
} from "../tasks/runtime-override.ts";

interface AutoWorkflowOptions {
  workingBranchResult: WorkingBranchResult;
  associatedProposalForCommit: ProviderProposal | undefined;
  associatedProposalFromBranch: ProviderProposal | undefined;
  triggerContext: OperationTriggerContext;
}

export async function executeAutoStrategy(
  provider: PlatformProvider,
  currentRunSettings: OperationRunSettings,
  opts: AutoWorkflowOptions,
) {
  const {
    // workingBranchResult,
    // associatedProposalForCommit,
    // associatedProposalFromBranch,
    triggerContext,
  } = opts;

  /**
   * Auto mode run settings.
   */
  let runSettings: OperationRunSettings = currentRunSettings;

  logger.header("Auto mode execution (prepare): Creating commit...");

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

  logger.stepStart("Starting: Evaluate auto mode trigger strategy");
  evaluateAutoModeTriggerStrategy(
    resolvedCommitsResult.entries,
    runSettings.config,
  );
  logger.stepFinish("Finished: Evaluate auto mode trigger strategy");

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
      targetBranchName: runSettings.inputs.triggerBranchName,
      force: false,
    },
  );
  logger.stepFinish("Finished: Commit changes");

  logger.debugStepStart("Starting: Export post prepare operation variables");
  await exportPostPrepareOperationVariables(
    provider,
    commitResult.hash,
    changesData,
    {
      config: runSettings.config,
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

  /////////////////////

  if (runSettings.config.tag.createTag) {
    logger.header(
      "Auto mode execution (publish): Creating tag and release...",
    );

    logger.debugStepStart("Starting: Export pre publish operation variables");
    await exportPrePublishOperationVariables(provider, nextVersion);
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
        currentVersion,
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
      commitResult.hash,
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
        "Skipped: Create release (config create release is false)",
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
        "Skipped: Attach release assets (no assets to attach or config create release is false)",
      );
    }

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
        currentVersion,
      });
      logger.stepFinish(
        "Finished: Resolve runtime config override (publish post commands)",
      );
    } else {
      logger.stepSkip(
        "Skipped: Resolve runtime config override (publish post commands)",
      );
    }
  } else {
    logger.header(
      "Auto mode execution (publish): Skip create tag and release (disabled in config)",
    );
  }

  return runSettings;
}

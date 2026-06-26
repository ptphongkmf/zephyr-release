import type { WorkingBranchResult } from "../tasks/branch.ts";
import {
  calculateNextVersion,
  compareNextVersionToCurrentVersion,
} from "../tasks/calculate-next-version/calculate-version.ts";
import { getCurrentVersion } from "../tasks/calculate-next-version/previous-version.ts";
import { format } from "@std/semver";
import { generatePrepareChangelogReleaseContent } from "../tasks/changelog.ts";
import {
  commitChangesToBranch,
  prepareChangesToCommit,
  resolveCommitsFromTriggerToLastRelease,
} from "../tasks/commit.ts";
import {
  exportPostCalculateVersionVariables,
  exportPostCommitVariables,
  exportPostProposalVariables,
  exportPostReleaseVariables,
  exportPreCalculateVersionVariables,
  exportPreCommitVariables,
  exportPreReleaseVariables,
  exportPreTagVariables,
} from "../tasks/export-variables.ts";
import { logger } from "../tasks/logger.ts";
import {
  addChangelogPatternContext,
  addCurrentVersionPatternContext,
  addNextVersionPatternContext,
  addReleasesPatternContext,
  addTagPatternContext,
  type StringPatternContext,
} from "../tasks/string-templates-and-patterns/pattern-context.ts";
import type {
  OperationRunSettings,
  OperationTriggerContext,
} from "../types/operation-context.ts";
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import type { ProviderProposal } from "../types/providers/proposal.ts";
import { evaluateAutoReleaseFlowTriggerStrategy } from "../tasks/auto-trigger-strategy.ts";
import { createTag } from "../tasks/tag.ts";
import { attachReleaseAssets, createRelease } from "../tasks/release.ts";
import type { ProviderRelease } from "../types/providers/release.ts";
import { executeHookWithOverride } from "../tasks/hook-runner.ts";

interface AutoWorkflowOptions {
  workingBranchResult: WorkingBranchResult;
  associatedProposalForCommit: ProviderProposal | undefined;
  associatedProposalFromBranch: ProviderProposal | undefined;
  triggerContext: OperationTriggerContext;
  patternContext: StringPatternContext;
}

export async function executeAutoReleaseFlow(
  provider: PlatformProvider,
  currentRunSettings: OperationRunSettings,
  opts: AutoWorkflowOptions,
) {
  const {
    // workingBranchResult,
    // associatedProposalForCommit,
    // associatedProposalFromBranch,
    triggerContext,
    patternContext: initialPatternContext,
  } = opts;

  let patternContext = initialPatternContext;

  /**
   * Auto release flow run settings.
   */
  let runSettings: OperationRunSettings = currentRunSettings;

  logger.header("Auto release flow (prepare): Creating commit...");

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

  ({ runSettings, patternContext } = await executeHookWithOverride(
    provider,
    "preCalculateVersion",
    runSettings.config.commandHooks,
    runSettings,
    patternContext,
  ));

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
    patternContext = addCurrentVersionPatternContext(patternContext, currentVersion);
  }
  patternContext = addNextVersionPatternContext(patternContext, nextVersion);
  patternContext = await addTagPatternContext(patternContext, runSettings.config.tag.nameTemplate);

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

  ({ runSettings, patternContext } = await executeHookWithOverride(
    provider,
    "postCalculateVersion",
    runSettings.config.commandHooks,
    runSettings,
    patternContext,
    { nextVersion, currentVersion },
  ));

  logger.stepStart("Starting: Evaluate auto release flow trigger strategy");
  evaluateAutoReleaseFlowTriggerStrategy(
    resolvedCommitsResult.entries,
    runSettings.config,
  );
  logger.stepFinish("Finished: Evaluate auto release flow trigger strategy");

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

  ({ runSettings, patternContext } = await executeHookWithOverride(
    provider,
    "preCommit",
    runSettings.config.commandHooks,
    runSettings,
    patternContext,
    { nextVersion, currentVersion },
  ));

  // Commit
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
    patternContext,
  );
  logger.stepFinish("Finished: Commit changes");

  // postCommit hook
  // Changes are committed and pushed. (No proposal in auto release flow.)
  logger.debugStepStart("Starting: Export post commit variables");
  await exportPostCommitVariables(provider, commitResult.hash, patternContext);
  logger.debugStepFinish("Finished: Export post commit variables");

  // In auto release flow, postProposal is merged with postCommit since there is no proposal.
  // In auto release flow, there is no proposal step. Export jobs data here alongside post commit.
  logger.debugStepStart(
    "Starting: Export post proposal variables (auto release flow)",
  );
  await exportPostProposalVariables(
    provider,
    undefined,
    {
      config: runSettings.config,
    },
    patternContext,
  );
  logger.debugStepFinish(
    "Finished: Export post proposal variables (auto release flow)",
  );

  ({ runSettings, patternContext } = await executeHookWithOverride(
    provider,
    "postCommit",
    runSettings.config.commandHooks,
    runSettings,
    patternContext,
    { nextVersion, currentVersion },
  ));

  /////////////////////

  if (runSettings.config.tag.createTag) {
    logger.header(
      "Auto release flow (publish): Creating tag and release...",
    );

    // preTag hook
    logger.debugStepStart("Starting: Export pre tag variables");
    await exportPreTagVariables(provider, nextVersion, patternContext);
    logger.debugStepFinish("Finished: Export pre tag variables");

    ({ runSettings, patternContext } = await executeHookWithOverride(
      provider,
      "preTag",
      runSettings.config.commandHooks,
      runSettings,
      patternContext,
      { nextVersion, currentVersion },
    ));

    // Create tag
    logger.stepStart("Starting: Create tag");
    const createdTag = await createTag(
      provider,
      commitResult.hash,
      runSettings.inputs,
      runSettings.config,
      patternContext,
    );
    logger.stepFinish("Finished: Create tag");

    // preRelease hook
    // Tag exists, platform release has NOT been created yet.
    logger.debugStepStart("Starting: Export pre release variables");
    await exportPreReleaseVariables(provider, createdTag.hash, patternContext);
    logger.debugStepFinish("Finished: Export pre release variables");

    ({ runSettings, patternContext } = await executeHookWithOverride(
      provider,
      "preRelease",
      runSettings.config.commandHooks,
      runSettings,
      patternContext,
      { nextVersion, currentVersion },
    ));

    // Create release and attach assets
    logger.stepStart("Starting: Create release");
    let createdReleaseNote: ProviderRelease | undefined;
    if (runSettings.config.release.createRelease) {
      createdReleaseNote = await createRelease(
        provider,
        runSettings.inputs,
        runSettings.config,
        patternContext,
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

    // postRelease hook
    // Platform release is live and assets are attached.
    logger.debugStepStart("Starting: Export post release variables");
    await exportPostReleaseVariables(
      provider,
      patternContext,
      createdReleaseNote?.id,
      createdReleaseNote?.uploadUrl,
    );
    logger.debugStepFinish("Finished: Export post release variables");

    ({ runSettings, patternContext } = await executeHookWithOverride(
      provider,
      "postRelease",
      runSettings.config.commandHooks,
      runSettings,
      patternContext,
      { nextVersion, currentVersion },
    ));
  } else {
    logger.header(
      "Auto release flow (publish): Skip create tag and release (disabled in config)",
    );
  }

  return runSettings;
}

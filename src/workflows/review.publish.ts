import { generatePublishChangelogReleaseContent } from "../tasks/changelog.ts";
import {
  exportPostReleaseVariables,
  exportPreReleaseVariables,
  exportPreTagVariables,
} from "../tasks/export-variables.ts";
import { updateProposalLabelsOnMerge } from "../tasks/label.ts";
import { logger } from "../tasks/logger.ts";
import { extractChangelogFromProposal } from "../tasks/proposal.ts";
import { attachReleaseAssets, createRelease } from "../tasks/release.ts";
import {
  addChangelogPatternContext,
  addNextVersionPatternContext,
  addReleasesPatternContext,
  addTagPatternContext,
  type StringPatternContext,
} from "../tasks/string-templates-and-patterns/pattern-context.ts";
import { createTag } from "../tasks/tag.ts";
import {
  getPrimaryVersionFile,
  getVersionSemVerFromVersionFile,
} from "../tasks/version-files/version-file.ts";
import { format } from "@std/semver";
import type { OperationRunSettings } from "../types/operation-context.ts";
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import type { ProviderProposal } from "../types/providers/proposal.ts";
import type { ProviderRelease } from "../types/providers/release.ts";
import { executeHookWithOverride } from "../tasks/hook-runner.ts";

export async function executeReviewPublishPhase(
  provider: PlatformProvider,
  currentRunSettings: OperationRunSettings,
  associatedProposalForCommit: ProviderProposal,
  initialPatternContext: StringPatternContext,
): Promise<OperationRunSettings> {
  /**
   * Publish phase run settings.
   */
  let runSettings: OperationRunSettings = currentRunSettings;
  let patternContext = initialPatternContext;

  logger.stepStart("Starting: Generate changelog release content");
  const proposalChangelogRelease = extractChangelogFromProposal(
    associatedProposalForCommit,
  );
  const changelogReleaseResult = await generatePublishChangelogReleaseContent(
    provider,
    proposalChangelogRelease ?? "",
    runSettings.inputs,
    runSettings.config,
    patternContext,
  );
  logger.stepFinish("Finished: Generate changelog release content");

  // Get version from version file
  logger.stepStart(
    "Starting: Extract next version from primary version file",
  );
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
  patternContext = addNextVersionPatternContext(patternContext, nextVersion);
  patternContext = await addTagPatternContext(patternContext, runSettings.config.tag.nameTemplate);

  patternContext = addReleasesPatternContext(patternContext, [{
    name: runSettings.config.name ?? "root",
    nextVersion: format(nextVersion),
    tagName: patternContext.tagName as string,
    isWorkspace: false,
  }]);
  logger.debugStepFinish(
    "Finished: Create fixed next version and tag string pattern context",
  );

  logger.debugStepStart(
    "Starting: Create dynamic changelog string pattern context",
  );
  patternContext = addChangelogPatternContext(
    patternContext,
    changelogReleaseResult?.release,
    changelogReleaseResult?.releaseBody,
    changelogReleaseResult?.releaseAlt,
    changelogReleaseResult?.releaseBodyAlt,
  );
  logger.debugStepFinish(
    "Finished: Create dynamic changelog string pattern context",
  );

  if (runSettings.config.tag.createTag) {
    logger.header(
      "Review release flow (publish): Creating tag and release...",
    );

    // preTag hook
    // About to create the Git tag.
    logger.debugStepStart("Starting: Export pre tag variables");
    await exportPreTagVariables(
      provider,
      nextVersion,
      patternContext,
      associatedProposalForCommit.id,
    );
    logger.debugStepFinish("Finished: Export pre tag variables");

    ({ runSettings, patternContext } = await executeHookWithOverride(
      provider,
      "preTag",
      runSettings.config.commandHooks,
      runSettings,
      patternContext,
      { nextVersion },
    ));

    // Create tag
    logger.stepStart("Starting: Create tag");
    const createdTag = await createTag(
      provider,
      runSettings.inputs.triggerCommitHash,
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
      { nextVersion },
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
      { nextVersion },
    ));
  } else {
    logger.header(
      "Review release flow (publish): Skip create tag and release (disabled in config)",
    );
  }

  return runSettings;
}

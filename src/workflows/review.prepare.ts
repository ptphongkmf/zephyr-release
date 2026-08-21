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
import { format, type SemVer } from "@std/semver";
import {
  addChangelogPatternContext,
  addCurrentVersionPatternContext,
  addNextVersionPatternContext,
  addReleasesPatternContext,
  addTagPatternContext,
  type ReleaseContextEntry,
} from "../tasks/string-templates-and-patterns/pattern-context.ts";
import { generatePrepareChangelogReleaseContent } from "../tasks/changelog.ts";
import {
  exportPostCalculateVersionVariables,
  exportPostCommitVariables,
  exportPostProposalVariables,
  exportPreCalculateVersionVariables,
  exportPreCommitVariables,
  exportWorkspaceSummaryVariables,
} from "../tasks/export-variables.ts";
import type { OperationRunSettings } from "../types/operation-context.ts";
import { addLabelsToProposalOnCreate } from "../tasks/label.ts";
import type { BootstrapResult } from "./bootstrap.ts";
import { executeHookWithOverride } from "./hook-runner.ts";
import {
  type AffectedWorkspace,
  detectAffectedWorkspaces,
} from "../tasks/workspace-detection.ts";
import type { ResolvedWorkspace } from "../types/workspace-context.ts";

/** Per-workspace result accumulated during Phase 1 */
interface WorkspaceVersionData {
  nextVersion: SemVer;
  currentVersion: SemVer | undefined;
}

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
   * Review prepare phase run settings.
   */
  let runSettings: OperationRunSettings = currentRunSettings;

  // ═══════════════════════════════════════════════════════════════════
  // Phase 1: Per-workspace version/changelog/files
  // ═══════════════════════════════════════════════════════════════════

  logger.heading(
    "Review release flow (prepare): Creating commit and proposal...",
  );

  // Detect affected workspaces
  const affectedWorkspaces: AffectedWorkspace[] = runSettings.isMonorepoMode
    ? await detectAffectedWorkspaces(
      provider,
      runSettings.workspaces,
      runSettings.inputs.triggerCommitHash,
      runSettings.config.maxCommitsToResolve,
    )
    : runSettings.workspaces.map((ws: ResolvedWorkspace) => ({
      ...ws,
      lastReleaseHash: undefined,
      lastReleaseTagName: undefined,
    }));

  if (affectedWorkspaces.length === 0) {
    logger.stepSkip(
      "No affected workspaces detected — nothing to release",
    );
    return runSettings;
  }

  const releaseEntries: ReleaseContextEntry[] = [];
  const allChangesData = new Map<string, string | null>();
  const workspaceVersionDataMap = new Map<
    string,
    WorkspaceVersionData
  >();

  for (const ws of affectedWorkspaces) {
    const wsConfig = ws.config;
    const wsLabel = runSettings.isMonorepoMode ? `[${wsConfig.name}] ` : "";

    if (runSettings.isMonorepoMode) {
      logger.subHeading(`Workspace: ${wsConfig.name}`);
      provider.setEnv("ZR_NAME", wsConfig.name ?? "");
    }

    // Get current version
    logger.stepStart(`${wsLabel}Starting: Get current version`);
    const currentVersion = await getCurrentVersion(
      provider,
      runSettings.inputs,
      wsConfig,
      ws.path,
    );
    logger.stepFinish(`${wsLabel}Finished: Get current version`);

    // Resolve commits
    logger.stepStart(
      `${wsLabel}Starting: Resolve commits from trigger to last release`,
    );
    const resolvedCommitsResult = await resolveCommitsFromTriggerToLastRelease(
      provider,
      runSettings.inputs,
      wsConfig,
      ws.lastReleaseHash,
      ws.path === "." ? undefined : ws.path,
    );
    logger.stepFinish(
      `${wsLabel}Finished: Resolve commits from trigger to last release`,
    );

    // preCalculateVersion hook
    logger.debugStepStart(
      `${wsLabel}Starting: Export pre calculate version variables`,
    );
    await exportPreCalculateVersionVariables(
      provider,
      resolvedCommitsResult.entries,
      patternContext,
    );
    logger.debugStepFinish(
      `${wsLabel}Finished: Export pre calculate version variables`,
    );

    ({ runSettings, patternContext } = await executeHookWithOverride(
      provider,
      "preCalculateVersion",
      wsConfig.commandHooks,
      runSettings,
      patternContext,
    ));

    // Calculate version
    logger.stepStart(`${wsLabel}Starting: Calculate next version`);
    const nextVersion = calculateNextVersion(
      resolvedCommitsResult,
      wsConfig,
      currentVersion,
    );
    logger.stepFinish(`${wsLabel}Finished: Calculate next version`);

    logger.stepStart(
      `${wsLabel}Starting: Compare calculated next version with current version`,
    );
    compareNextVersionToCurrentVersion(
      nextVersion,
      currentVersion,
    );
    logger.stepFinish(
      `${wsLabel}Finished: Compare calculated next version with current version`,
    );

    // Build per-workspace pattern context
    logger.debugStepStart(
      `${wsLabel}Starting: Create fixed version and tag string pattern context`,
    );
    let wsPatternContext = patternContext;
    if (currentVersion) {
      wsPatternContext = addCurrentVersionPatternContext(
        wsPatternContext,
        currentVersion,
      );
    }
    wsPatternContext = addNextVersionPatternContext(
      wsPatternContext,
      nextVersion,
    );
    wsPatternContext = await addTagPatternContext(
      wsPatternContext,
      wsConfig.tag.nameTemplate,
    );
    logger.debugStepFinish(
      `${wsLabel}Finished: Create fixed version and tag string pattern context`,
    );

    // Collect release entry
    const tagName = wsPatternContext.tagName as string;
    releaseEntries.push({
      name: wsConfig.name ?? "root",
      nextVersion: format(nextVersion),
      tagName,
      isWorkspace: ws.isWorkspace,
    });

    // postCalculateVersion hook
    logger.debugStepStart(
      `${wsLabel}Starting: Export post calculate version variables`,
    );
    await exportPostCalculateVersionVariables(
      provider,
      currentVersion,
      nextVersion,
      wsPatternContext,
    );
    logger.debugStepFinish(
      `${wsLabel}Finished: Export post calculate version variables`,
    );

    ({ runSettings, patternContext: wsPatternContext } =
      await executeHookWithOverride(
        provider,
        "postCalculateVersion",
        wsConfig.commandHooks,
        runSettings,
        wsPatternContext,
        { nextVersion, currentVersion },
      ));

    // Generate changelog
    logger.stepStart(
      `${wsLabel}Starting: Generate changelog release content`,
    );
    const changelogReleaseResult = await generatePrepareChangelogReleaseContent(
      provider,
      resolvedCommitsResult.entries,
      runSettings.inputs,
      wsConfig,
      wsPatternContext,
    );
    logger.stepFinish(
      `${wsLabel}Finished: Generate changelog release content`,
    );

    logger.debugStepStart(
      `${wsLabel}Starting: Create dynamic changelog string pattern context`,
    );
    wsPatternContext = addChangelogPatternContext(
      wsPatternContext,
      changelogReleaseResult.release,
      changelogReleaseResult.releaseBody,
      changelogReleaseResult.releaseAlt,
      changelogReleaseResult.releaseBodyAlt,
    );
    logger.debugStepFinish(
      `${wsLabel}Finished: Create dynamic changelog string pattern context`,
    );

    // Prepare changes to commit (workspace-relative paths)
    logger.stepStart(
      `${wsLabel}Starting: Prepare and collect changes data to commit`,
    );
    const wsChangesData = await prepareChangesToCommit(
      provider,
      runSettings.inputs,
      wsConfig,
      nextVersion,
      wsPatternContext,
      ws.path,
    );
    logger.stepFinish(
      `${wsLabel}Finished: Prepare and collect changes data to commit`,
    );

    // Accumulate changes across all workspaces
    for (const [filePath, content] of wsChangesData) {
      allChangesData.set(filePath, content);
    }

    // Store per-workspace version data
    workspaceVersionDataMap.set(wsConfig.name ?? "root", {
      nextVersion,
      currentVersion,
    });

    // Update shared pattern context
    patternContext = wsPatternContext;
  }

  // Export workspace summary variables (after all workspace versions are known)
  exportWorkspaceSummaryVariables(
    provider,
    runSettings.isMonorepoMode,
    affectedWorkspaces[0]?.config.name,
    releaseEntries.map((entry, i) => ({
      name: entry.name,
      nextVersion: entry.nextVersion,
      tagName: entry.tagName,
      path: affectedWorkspaces[i]!.path,
    })),
    affectedWorkspaces.map((ws) => ws.config.name ?? "root"),
  );

  // ═══════════════════════════════════════════════════════════════════
  // Phase 2: Global commit + proposal
  // ═══════════════════════════════════════════════════════════════════

  // Set releases pattern context (all workspaces)
  patternContext = addReleasesPatternContext(patternContext, releaseEntries);

  // Get first workspace version for backward compat in global hooks
  const firstWsVersionData = workspaceVersionDataMap.values().next().value;

  // preCommit hook (global, root config)
  logger.debugStepStart("Starting: Export pre commit variables");
  await exportPreCommitVariables(provider, allChangesData, patternContext);
  logger.debugStepFinish("Finished: Export pre commit variables");

  ({ runSettings, patternContext } = await executeHookWithOverride(
    provider,
    "preCommit",
    runSettings.config.commandHooks,
    runSettings,
    patternContext,
    {
      nextVersion: firstWsVersionData?.nextVersion,
      currentVersion: firstWsVersionData?.currentVersion,
    },
  ));

  // Commit all changes in one commit
  logger.stepStart("Starting: Commit changes");
  const commitResult = await commitChangesToBranch(
    provider,
    runSettings.inputs,
    runSettings.config,
    {
      baseTreeHash: triggerContext.latestTriggerCommit.treeHash,
      changesToCommit: allChangesData,
      targetBranchName: workingBranchResult.name,
      force: true,
    },
    patternContext,
  );
  logger.stepFinish("Finished: Commit changes");

  // postCommit hook
  logger.debugStepStart("Starting: Export post commit variables");
  await exportPostCommitVariables(provider, commitResult.hash, patternContext);
  logger.debugStepFinish("Finished: Export post commit variables");

  ({ runSettings, patternContext } = await executeHookWithOverride(
    provider,
    "postCommit",
    runSettings.config.commandHooks,
    runSettings,
    patternContext,
    {
      nextVersion: firstWsVersionData?.nextVersion,
      currentVersion: firstWsVersionData?.currentVersion,
    },
  ));

  // ═══════════════════════════════════════════════════════════════════
  // Proposal management (single proposal for all workspaces)
  // ═══════════════════════════════════════════════════════════════════

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

  if (runSettings.config.review.labels.onCreate) {
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

  // postProposal hook (global, root config)
  logger.debugStepStart("Starting: Export post proposal variables");
  await exportPostProposalVariables(
    provider,
    proposal.id,
    undefined,
    patternContext,
  );
  logger.debugStepFinish("Finished: Export post proposal variables");

  ({ runSettings, patternContext } = await executeHookWithOverride(
    provider,
    "postProposal",
    runSettings.config.commandHooks,
    runSettings,
    patternContext,
    {
      nextVersion: firstWsVersionData?.nextVersion,
      currentVersion: firstWsVersionData?.currentVersion,
    },
  ));

  return runSettings;
}

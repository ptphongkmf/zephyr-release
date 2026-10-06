import { canParse, format, parse, type SemVer } from "@std/semver";
import type { Commit } from "conventional-commits-parser";
import type { ResolvedCommitsResult } from "../commit.ts";
import { taskLogger } from "../logger.ts";
import type { ResolvedConfig } from "../../schemas/configs/resolved-config.ts";
import { AllowReleaseAsOptions } from "../../constants/release-as-options.ts";
import { calculateNextCoreSemVer } from "./core-calculations.ts";
import { calculateNextExtensionsSemVer } from "./extension-calculations.ts";
import { SafeExit } from "../../errors/safe-exit.ts";

type CalculateNextVersionConfigParams = Pick<
  ResolvedConfig,
  | "timeZone"
  | "initialVersion"
  | "commitTypes"
  | "allowedReleaseAsCommitTypes"
  | "bumpStrategy"
>;

/** @throws */
export function calculateNextVersion(
  resolvedCommitsResult: ResolvedCommitsResult,
  resolvedConfig: CalculateNextVersionConfigParams,
  currentVersion: SemVer | undefined,
): SemVer {
  const { resolvedTriggerCommit, entries } = resolvedCommitsResult;
  const {
    timeZone,
    initialVersion,
    commitTypes,
    allowedReleaseAsCommitTypes,
    bumpStrategy,
  } = resolvedConfig;

  taskLogger.info(
    "Checking if there is release-as trigger (manual version set)...",
  );
  const manualReleaseAsVersion = resolveManualReleaseAsVersion(
    resolvedTriggerCommit,
    commitTypes,
    allowedReleaseAsCommitTypes,
  );
  if (manualReleaseAsVersion) {
    return manualReleaseAsVersion;
  }

  // No current version, return initial version
  if (!currentVersion) {
    taskLogger.info(
      `No current version found, using initial version: ${initialVersion}`,
    );

    if (!canParse(initialVersion)) {
      throw new Error(
        `Initial version '${initialVersion}' is not a valid semver object`,
      );
    }

    return parse(initialVersion);
  }

  // Version is 0.0.0
  if (
    currentVersion.major === 0 &&
    currentVersion.minor === 0 &&
    currentVersion.patch === 0 &&
    (currentVersion.prerelease?.length ?? 0) === 0 &&
    (currentVersion.build?.length ?? 0) === 0 &&
    initialVersion !== "0.0.0"
  ) {
    taskLogger.info(
      "Current version is 0.0.0, treating it as if there is no current version and using initial version for calculation",
    );

    if (!canParse(initialVersion)) {
      throw new Error(
        `Initial version '${initialVersion}' is not a valid semver object`,
      );
    }

    return parse(initialVersion);
  }

  // Current version exists, calculate the next version
  taskLogger.info(
    `Current version got from version file is ${currentVersion}`,
  );

  // Calculate next version from current version
  const nextCoreSemVer = calculateNextCoreSemVer(
    currentVersion,
    entries,
    bumpStrategy,
  );

  const nextExtensionSemVer = calculateNextExtensionsSemVer(
    currentVersion,
    nextCoreSemVer,
    bumpStrategy,
    timeZone,
  );

  const finalSemVer: SemVer = {
    major: nextCoreSemVer.major,
    minor: nextCoreSemVer.minor,
    patch: nextCoreSemVer.patch,
    prerelease: nextExtensionSemVer.prerelease,
    build: nextExtensionSemVer.build,
  };
  const finalVersion = format(finalSemVer);
  taskLogger.info(`Final calculated next version: ${finalVersion}`);

  return finalSemVer;
}

function resolveManualReleaseAsVersion(
  triggerCommit: Commit,
  commitTypes: CalculateNextVersionConfigParams["commitTypes"],
  allowReleaseAs:
    CalculateNextVersionConfigParams["allowedReleaseAsCommitTypes"],
): SemVer | undefined {
  const releaseAsNote = triggerCommit.notes.find((n) =>
    n.title.toLowerCase() === "release as" ||
    n.title.toLowerCase() === "release-as"
  );
  if (!releaseAsNote) return undefined;

  const isAllowed = isReleaseAsAllowed(
    triggerCommit.type,
    allowReleaseAs,
    commitTypes,
  );
  if (!isAllowed) {
    taskLogger.info(
      `Found release-as footer but commit type '${triggerCommit.type}' is not allowed to trigger 'release-as'`,
    );

    return undefined;
  }

  if (!canParse(releaseAsNote.text)) {
    return undefined;
  }

  return parse(releaseAsNote.text);
}

/**
 * Validates if a specific commit type matches the 'allowReleaseAs' policy.
 */
function isReleaseAsAllowed(
  type: string | null | undefined,
  allowReleaseAs:
    CalculateNextVersionConfigParams["allowedReleaseAsCommitTypes"],
  commitTypes: CalculateNextVersionConfigParams["commitTypes"],
): boolean {
  if (allowReleaseAs.includes(AllowReleaseAsOptions.all)) return true;

  if (!type) return false;

  const currentType = type.toLowerCase();

  if (allowReleaseAs.includes(currentType)) return true;

  if (allowReleaseAs.includes(AllowReleaseAsOptions.commitTypes)) {
    return commitTypes.some((ct) => ct.type === currentType);
  }

  return false;
}

/** @throws {SafeExit} */
export function compareNextVersionToCurrentVersion(
  nextVersion: SemVer,
  currentVersion: SemVer | undefined,
) {
  if (!currentVersion) {
    taskLogger.info(
      "Current version is undefined; calculated next version is considered valid",
    );
    return;
  }

  const nextVersionStr = format(nextVersion);
  const currentVersionStr = format(currentVersion);

  if (nextVersionStr === currentVersionStr) {
    throw new SafeExit(
      `Calculated next version (${nextVersionStr}) is unchanged compared to current version (${currentVersionStr})`,
    );
  } else {
    taskLogger.info(
      `Calculated next version (${nextVersionStr}) is different from current version (${currentVersionStr}). Proceeding...`,
    );
    return;
  }
}

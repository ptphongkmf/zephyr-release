import type { SemVer } from "@std/semver";
import type { ResolvedCommit } from "../commit.ts";
import type { BumpStrategyConfigResolvedOutput } from "../../schemas/configs/modules/bump-strategy-config.ts";
import type { BumpRuleCoreResolvedOutput } from "../../schemas/configs/modules/components/bump-rule-core.ts";
import { countBreakingAsOptions } from "../../constants/bump-rules.ts";

export function calculateNextCoreSemVer(
  currentSemVer: SemVer,
  entries: ResolvedCommit[],
  strategy: BumpStrategyConfigResolvedOutput,
): SemVer {
  // 1. ANALYSIS PHASE: collect raw data
  const rawCounts = {
    major: { commits: 0, directBumps: 0 },
    minor: { commits: 0, directBumps: 0 },
    patch: { commits: 0, directBumps: 0 },
  };

  for (const entry of entries) {
    const majorCounts = getBumpRuleCounts(entry, strategy.major);
    rawCounts.major.commits += majorCounts.commits;
    rawCounts.major.directBumps += majorCounts.directBumps;

    const minorCounts = getBumpRuleCounts(entry, strategy.minor);
    rawCounts.minor.commits += minorCounts.commits;
    rawCounts.minor.directBumps += minorCounts.directBumps;

    const patchCounts = getBumpRuleCounts(entry, strategy.patch);
    rawCounts.patch.commits += patchCounts.commits;
    rawCounts.patch.directBumps += patchCounts.directBumps;
  }

  // 2. REDIRECTION PHASE: Handle Pre-Stable (0.x.x) Logic via Raw Counts Transfer
  if (currentSemVer.major === 0) {
    const origMajor = { ...rawCounts.major };
    const origMinor = { ...rawCounts.minor };

    if (
      strategy.treatMajorAsMinorPreStable &&
      (origMajor.commits > 0 || origMajor.directBumps > 0)
    ) {
      // Downgrade Major -> Minor
      rawCounts.major = { commits: 0, directBumps: 0 };
      rawCounts.minor.commits += origMajor.commits;
      rawCounts.minor.directBumps += origMajor.directBumps;
    }

    if (
      strategy.treatMinorAsPatchPreStable &&
      (origMinor.commits > 0 || origMinor.directBumps > 0)
    ) {
      // Downgrade original Minor -> Patch (excludes downgraded majors)
      rawCounts.minor.commits -= origMinor.commits;
      rawCounts.minor.directBumps -= origMinor.directBumps;
      rawCounts.patch.commits += origMinor.commits;
      rawCounts.patch.directBumps += origMinor.directBumps;
    }
  }

  // 3. CALCULATION PHASE: convert commits to bumps (apply 'commitsPerBump')
  const majorBumps = rawCounts.major.directBumps +
    calculateBumpsFromCommits(
      rawCounts.major.commits,
      strategy.major?.commitsPerBump,
    );

  const minorBumps = rawCounts.minor.directBumps +
    calculateBumpsFromCommits(
      rawCounts.minor.commits,
      strategy.minor?.commitsPerBump,
    );

  const patchBumps = rawCounts.patch.directBumps +
    calculateBumpsFromCommits(
      rawCounts.patch.commits,
      strategy.patch?.commitsPerBump,
    );

  // 4. APPLICATION PHASE: The "Highest Wins" Optimization
  // A Major bump resets lower fields. A Minor bump resets Patch.
  const nextCoreSemver = { ...currentSemVer };

  if (majorBumps > 0) {
    nextCoreSemver.major += majorBumps;
    nextCoreSemver.minor = 0;
    nextCoreSemver.patch = 0;
  } else if (minorBumps > 0) {
    nextCoreSemver.minor += minorBumps;
    nextCoreSemver.patch = 0;
  } else if (patchBumps > 0) {
    nextCoreSemver.patch += patchBumps;
  }

  return nextCoreSemver;
}

/**
 * Helper to compute the counts based on a specific rule.
 * Pure function that returns the computed increments.
 */
function getBumpRuleCounts(
  entry: ResolvedCommit,
  rule: BumpRuleCoreResolvedOutput,
): { commits: number; directBumps: number } {
  // Priority 1: Breaking Changes
  if (entry.isBreaking) {
    if (rule.countBreakingAs === countBreakingAsOptions.bump) {
      return { commits: 0, directBumps: 1 };
    }
    if (rule.countBreakingAs === countBreakingAsOptions.commit) {
      return { commits: 1, directBumps: 0 };
    }

    // If "none", we ignore the breaking aspect and check the type below
  }

  // Priority 2: Commit Types
  if (rule.types && rule.types.includes(entry.type)) {
    return { commits: 1, directBumps: 0 };
  }

  return { commits: 0, directBumps: 0 };
}

function calculateBumpsFromCommits(
  count: number,
  commitsPerBump: number,
): number {
  if (count === 0) return 0;
  if (commitsPerBump === Infinity || commitsPerBump <= 0) return 1;

  // Formula: 1st bump needs 1 commit. Subsequent bumps need N commits.
  // 5 commits, limit 5 -> 1 bump
  // 6 commits, limit 5 -> 2 bumps
  return 1 + Math.floor((count - 1) / commitsPerBump);
}

import { SafeExit } from "../errors/safe-exit.ts";
import type { ResolvedConfig } from "../schemas/configs/resolved-config.ts";
import type { AutoConfigResolvedOutput } from "../schemas/configs/modules/auto-config.ts";
import type { ResolvedCommit } from "./commit.ts";

type evaluateTriggerStrategyConfigParams = Pick<ResolvedConfig, "commitTypes"> & {
  auto: Pick<AutoConfigResolvedOutput, "triggerStrategy">;
};

/** @throws {SafeExit} */
export function evaluateAutoReleaseFlowTriggerStrategy(
  resolvedCommits: ResolvedCommit[],
  resolvedConfig: evaluateTriggerStrategyConfigParams,
) {
  const { commitTypes } = resolvedConfig;
  const { triggerStrategy } = resolvedConfig.auto;

  let result = false;

  switch (triggerStrategy.type) {
    case "commit-types": {
      const allowedTypes = new Set<string>();

      if (triggerStrategy.allowedTypes) {
        const strategyAllowedTypes = new Set(triggerStrategy.allowedTypes);

        for (const ct of commitTypes) {
          if (strategyAllowedTypes.has(ct.type)) allowedTypes.add(ct.type);
        }
      } else {
        for (const ct of commitTypes) {
          allowedTypes.add(ct.type);
        }
      }

      let totalTypeCount = 0;
      const typeCounts = new Map<string, number>();

      let countSatisfied = false;
      let breakingSatisfied = !triggerStrategy.requireBreaking;

      for (const rc of resolvedCommits) {
        if (!allowedTypes.has(rc.type)) continue;

        if (!breakingSatisfied && rc.isBreaking) {
          breakingSatisfied = true;
        }

        if (!countSatisfied) {
          totalTypeCount++;

          const currentTypeCount = (typeCounts.get(rc.type) ?? 0) + 1;
          typeCounts.set(rc.type, currentTypeCount);

          countSatisfied = hasReachedStrategyMinCommitCount(
            rc.type,
            currentTypeCount,
            totalTypeCount,
            triggerStrategy.minCommitCount,
          );
        }

        // Early Exit
        if (countSatisfied && breakingSatisfied) {
          result = true;
          break;
        }
      }

      break;
    }

    case "commit-footer": {
      const normalizedToken = triggerStrategy.token.toLowerCase();
      const normalizedValue = triggerStrategy.value?.trim().toLowerCase();

      for (const rc of resolvedCommits) {
        const hasMatchingFooter = rc.notes.some((note) => {
          // Token must match (case-insensitive)
          if (note.title.toLowerCase() !== normalizedToken) {
            return false;
          }

          // If config requires a specific value, it must match (case-insensitive & trimmed)
          if (normalizedValue !== undefined) {
            return note.text.trim().toLowerCase() === normalizedValue;
          }

          // If no value is required by config, just having the token is enough!
          return true;
        });

        if (hasMatchingFooter) {
          result = true;
          break; // We found the trigger! Break early.
        }
      }

      break;
    }
    case "flag":
      result = triggerStrategy.value;
      break;
  }

  if (!result) {
    throw new SafeExit(
      `Auto release aborted: the required trigger strategy conditions were not met (${triggerStrategy.type})`,
    );
  }
}

function hasReachedStrategyMinCommitCount(
  type: string,
  typeCount: number,
  totalCount: number,
  countConfig: number | Record<string, number>,
): boolean {
  if (typeof countConfig === "number") {
    return totalCount >= countConfig;
  } else {
    return typeCount >= (countConfig[type] ?? 1);
  }
}

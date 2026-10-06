import { LabelOnMergeRemoveOptions } from "../constants/label-options.ts";
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import { taskLogger } from "./logger.ts";
import type { LabelItemResolvedOutput } from "../schemas/configs/modules/components/label.ts";
import { failedNonCriticalTasks } from "../main.ts";

export async function addLabelsToProposalOnCreate(
  provider: PlatformProvider,
  proposalId: string,
  labelsToAdd: LabelItemResolvedOutput[],
) {
  try {
    taskLogger.info(
      `Adding ${labelsToAdd.length} labels to created proposal...`,
    );
    await provider.addLabelsToProposal(proposalId, labelsToAdd);
  } catch (error) {
    const message = `Failed to add labels to proposal: ${
      error instanceof Error ? error.message : String(error)
    }`;

    taskLogger.warn(message);
    failedNonCriticalTasks.push(message);
  }
}

export async function updateProposalLabelsOnMerge(
  provider: PlatformProvider,
  proposalId: string,
  labelsToAdd?: LabelItemResolvedOutput[],
  labelsToRemove?: LabelItemResolvedOutput[],
) {
  try {
    if (labelsToAdd) {
      taskLogger.info(
        `Adding ${labelsToAdd.length} labels to merged proposal...`,
      );
      await provider.addLabelsToProposal(proposalId, labelsToAdd);
    }

    if (labelsToRemove) {
      const resolvedRemoveSet = new Set<string>();

      for (const label of labelsToRemove) {
        if (
          label.name === LabelOnMergeRemoveOptions.allOnCreate && labelsToAdd
        ) {
          labelsToAdd.forEach((l) => resolvedRemoveSet.add(l.name));
        } else {
          resolvedRemoveSet.add(label.name);
        }
      }

      taskLogger.info(
        `Removing ${resolvedRemoveSet.size} labels from merged proposal...`,
      );
      await provider.removeLabelsFromProposal(proposalId, [
        ...resolvedRemoveSet,
      ]);
    }
  } catch (error) {
    const message = `Failed to update proposal labels on merge: ${
      error instanceof Error ? error.message : String(error)
    }`;

    taskLogger.warn(message);
    failedNonCriticalTasks.push(message);
  }
}

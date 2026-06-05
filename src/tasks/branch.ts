import { taskLogger } from "./logger.ts";
import type { InputsOutput } from "../schemas/inputs/inputs.ts";
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import type { ProviderBranch } from "../types/providers/branch.ts";

type SetupWorkingBranchInputsParams = Pick<
  InputsOutput,
  "triggerCommitHash"
>;

export type WorkingBranchResult = ProviderBranch & { name: string };

/** @throws */
export async function setupWorkingBranch(
  provider: PlatformProvider,
  inputs: SetupWorkingBranchInputsParams,
  branchName: string,
): Promise<WorkingBranchResult> {
  const { triggerCommitHash } = inputs;

  const workingBranch = await provider.ensureBranchExist(
    branchName,
    triggerCommitHash,
  );

  taskLogger.debug(
    `Ensured working branch '${branchName}' at commit ${triggerCommitHash}:\n` +
      JSON.stringify(workingBranch, null, 2),
  );

  return {
    ...workingBranch,
    name: workingBranch.ref.replace("refs/heads/", ""),
  };
}

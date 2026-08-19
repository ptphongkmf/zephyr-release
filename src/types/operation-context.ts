import type { Commit } from "conventional-commits-parser";
import type { ProviderInputs } from "./providers/inputs.ts";
import type { ConfigOutput } from "../schemas/configs/config.ts";
import type { InputsOutput } from "../schemas/inputs/inputs.ts";
import type { ResolvedWorkspace } from "./workspace-context.ts";

export interface OperationTriggerContext {
  latestTriggerCommit: { parsedCommit: Commit; treeHash: string };
  parsedTriggerCommits: Commit[];
  commitHasAllowedType: boolean;
}

export interface OperationRunSettings {
  rawInputs: ProviderInputs;
  inputs: InputsOutput;
  rawConfig: object;
  config: ConfigOutput;
  isMonorepoMode: boolean;
  workspaces: ResolvedWorkspace[];
}

import { SafeExit } from "../errors/safe-exit.ts";
import type { ConfigOutput } from "../schemas/configs/config.ts";
import type { InputsOutput } from "../schemas/inputs/inputs.ts";
import {
  setupWorkingBranch,
  type WorkingBranchResult,
} from "../tasks/branch.ts";
import { logger } from "../tasks/logger.ts";
import { validateCurrentOperationTriggerCtx } from "../tasks/operation.ts";
import {
  findMergedProposalByCommit,
  findOpenProposal,
} from "../tasks/proposal.ts";
import {
  createEmptyPatternContext,
  addCustomPatternContext,
  addBasePatternContext,
  addWorkingBranchPatternContext,
  addDatetimePatternContext,
  type StringPatternContext,
} from "../tasks/string-templates-and-patterns/pattern-context.ts";
import { resolveStringTemplate } from "../tasks/string-templates-and-patterns/resolve-template.ts";
import { registerTransformersToTemplateEngine } from "../tasks/string-templates-and-patterns/transformers.ts";
import type { OperationTriggerContext } from "../types/operation-context.ts";
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import type { ProviderProposal } from "../types/providers/proposal.ts";

export interface BootstrapResult {
  triggerContext: OperationTriggerContext;
  workingBranchResult: WorkingBranchResult;
  associatedProposalForCommit: ProviderProposal | undefined;
  associatedProposalFromBranch: ProviderProposal | undefined;
  patternContext: StringPatternContext;
}

export async function bootstrapOperation(
  provider: PlatformProvider,
  config: ConfigOutput,
  inputs: InputsOutput,
  isMonorepoMode: boolean,
): Promise<BootstrapResult> {
  logger.stepStart("Starting: Parse and validate current trigger context");
  const triggerContext = validateCurrentOperationTriggerCtx(
    provider,
    config.commitTypes,
    config.releaseFlow,
  );
  logger.stepFinish("Finished: Parse and validate current trigger context");

  logger.stepStart("Starting: Register transformers to template engine");
  registerTransformersToTemplateEngine(provider);
  logger.stepFinish("Finished: Register transformers to template engine");

  logger.debugStepStart("Starting: Create string pattern context");
  let patternContext = createEmptyPatternContext();
  patternContext = addCustomPatternContext(patternContext, config.customStringPatterns);

  patternContext = addBasePatternContext(
    patternContext,
    provider,
    inputs.triggerBranchName,
    config,
    isMonorepoMode,
  );

  const workingBranchName = await resolveStringTemplate(
    config.review.workingBranchNameTemplate,
    patternContext,
  );

  patternContext = addWorkingBranchPatternContext(
    patternContext,
    workingBranchName,
  );

  patternContext = addDatetimePatternContext(patternContext, config.timeZone);
  logger.debugStepFinish("Finished: Create string pattern context");

  logger.stepStart("Starting: Ensure working branch is prepared");
  const workingBranchResult = await setupWorkingBranch(
    provider,
    inputs,
    workingBranchName,
  );
  logger.stepFinish("Finished: Ensure working branch is prepared");

  let associatedProposalForCommit: ProviderProposal | undefined;
  let associatedProposalFromBranch: ProviderProposal | undefined;
  if (config.releaseFlow === "review") {
    logger.stepStart("Starting: Get associated proposals");
    associatedProposalForCommit = await findMergedProposalByCommit(
      provider,
      workingBranchResult.name,
      inputs,
    );

    if (!triggerContext.commitHasAllowedType && !associatedProposalForCommit) {
      throw new SafeExit(
        "The trigger commit lacks an allowed type and has been verified not to be a merged release proposal",
      );
    }

    associatedProposalFromBranch = await findOpenProposal(
      provider,
      workingBranchResult.name,
      inputs,
    );
    logger.stepFinish("Finished: Get associated proposals");
  }

  return {
    triggerContext,
    workingBranchResult,
    associatedProposalForCommit,
    associatedProposalFromBranch,
    patternContext: patternContext,
  };
}

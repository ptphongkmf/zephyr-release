import * as v from "@valibot/valibot";
import { taskLogger } from "./logger.ts";
import { type InputsOutput, InputsSchema } from "../schemas/inputs/inputs.ts";
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import { formatValibotIssues } from "../utils/formatters/valibot.ts";
import { transformObjKeyToCamelCase } from "../utils/transformers/object.ts";
import { INPUTS_PRESERVE_KEYS_AT_PATH } from "../schemas/inputs/inputs-preserve-keys.ts";
import type { ProviderInputs } from "../types/providers/inputs.ts";
import { SourceModeOptions } from "../constants/source-mode-options.ts";

interface GetInputsResult {
  rawInputs: ProviderInputs;
  inputs: InputsOutput;
}

/**
 * Get and validate inputs for the current operation
 * @throws
 */
export function getInputs(provider: PlatformProvider): GetInputsResult {
  const rawInputs = provider.getRawInputs();
  let processedRawInputs: unknown = rawInputs;

  if (
    rawInputs.sourceMode &&
    !v.safeParse(v.enum(SourceModeOptions), rawInputs.sourceMode).success
  ) {
    processedRawInputs = {
      ...rawInputs,
      sourceMode: JSON.parse(rawInputs.sourceMode),
    };
  }

  processedRawInputs = transformObjKeyToCamelCase(processedRawInputs, {
    preserveKeysAtPaths: INPUTS_PRESERVE_KEYS_AT_PATH,
  });

  const parsedInputsResult = v.safeParse(InputsSchema, processedRawInputs);
  if (!parsedInputsResult.success) {
    throw new Error(
      `\`${getInputs.name}\` failed!` +
        formatValibotIssues(parsedInputsResult.issues),
    );
  }

  taskLogger.startGroup("Parsed inputs:");
  taskLogger.info(JSON.stringify(parsedInputsResult.output, null, 2));
  taskLogger.endGroup();

  return { rawInputs, inputs: parsedInputsResult.output };
}

import { deepMerge } from "@std/collections";
import * as v from "@valibot/valibot";
import { taskLogger } from "../logger.ts";
import { getTextFile } from "../file.ts";
import { jsonValueNormalizer } from "../../utils/transformers/json.ts";
import {
  type ConfigOutput,
  ConfigSchema,
} from "../../schemas/configs/config.ts";
import type { InputsOutput } from "../../schemas/inputs/inputs.ts";
import type { PlatformProvider } from "../../types/providers/platform-provider.ts";
import { formatValibotIssues } from "../../utils/formatters/valibot.ts";
import { parseConfig } from "./config-parser.ts";
import { transformObjKeyToCamelCase } from "../../utils/transformers/object.ts";
import { CONFIG_PRESERVE_KEYS_AT_PATH } from "../../schemas/configs/config-preserve-keys.ts";

type ResolveConfigInputsParams = Pick<
  InputsOutput,
  | "triggerCommitHash"
  | "configPath"
  | "configFormat"
  | "configOverride"
  | "configOverrideFormat"
>;

interface ResolvedConfigContext {
  rawConfig: object;
  config: ConfigOutput;
}

/** @throws */
export async function resolveConfig(
  provider: PlatformProvider,
  inputs: ResolveConfigInputsParams,
): Promise<ResolvedConfigContext> {
  const {
    triggerCommitHash,
    configPath,
    configFormat,
    configOverride,
    configOverrideFormat,
  } = inputs;

  let rawParsedConfigFile: object | undefined;
  let rawParsedConfigOverride: object | undefined;
  let rawParsedFinalConfig: object | undefined;

  let parsedConfigFile: object | undefined;
  let parsedConfigOverride: object | undefined;
  let parsedFinalConfig: object | undefined;

  taskLogger.info("Reading config file from path...");
  if (configPath) {
    const configText = await getTextFile("remote", configPath, {
      provider,
      ref: triggerCommitHash,
    });

    const parsedResult = parseConfig(
      configText,
      configFormat,
      configPath,
    );

    rawParsedConfigFile = parsedResult.parsedConfig;
    parsedConfigFile = transformObjKeyToCamelCase(parsedResult.parsedConfig, {
      preserveKeysAtPaths: CONFIG_PRESERVE_KEYS_AT_PATH,
    });

    taskLogger.info(
      `Config file parsed successfully (${parsedResult.resolvedFormatResult})`,
    );
    taskLogger.debugWrap((dLogger) => {
      dLogger.startGroup("Parsed config file:");
      dLogger.info(JSON.stringify(parsedConfigFile, jsonValueNormalizer, 2));
      dLogger.endGroup();
    });
  } else {
    taskLogger.info("Config path not provided. Skipping...");
  }

  taskLogger.info("Reading config override from inputs...");
  if (configOverride) {
    const parsedResult = parseConfig(
      configOverride,
      configOverrideFormat,
    );

    rawParsedConfigOverride = parsedResult.parsedConfig;
    parsedConfigOverride = transformObjKeyToCamelCase(
      parsedResult.parsedConfig,
      { preserveKeysAtPaths: CONFIG_PRESERVE_KEYS_AT_PATH },
    );

    taskLogger.info(
      `Config override parsed successfully (${parsedResult.resolvedFormatResult})`,
    );
    taskLogger.debugWrap((dLogger) => {
      dLogger.startGroup("Parsed config override:");
      dLogger.info(
        JSON.stringify(parsedConfigOverride, jsonValueNormalizer, 2),
      );
      dLogger.endGroup();
    });
  } else {
    taskLogger.info("Config override not provided. Skipping...");
  }

  taskLogger.info("Resolving final config...");
  if (
    rawParsedConfigFile && rawParsedConfigOverride &&
    parsedConfigFile && parsedConfigOverride
  ) {
    taskLogger.info("Both config file and config override exist, merging...");
    rawParsedFinalConfig = deepMerge(
      rawParsedConfigFile,
      rawParsedConfigOverride,
      { arrays: "replace" },
    );
    parsedFinalConfig = deepMerge(
      parsedConfigFile,
      parsedConfigOverride,
      { arrays: "replace" },
    );
  } else if (rawParsedConfigFile && parsedConfigFile) {
    taskLogger.info("Only config file exist, use config file as final config");
    rawParsedFinalConfig = rawParsedConfigFile;
    parsedFinalConfig = parsedConfigFile;
  } else if (rawParsedConfigOverride && parsedConfigOverride) {
    taskLogger.info(
      "Only config override exist, use config override as final config",
    );
    rawParsedFinalConfig = rawParsedConfigOverride;
    parsedFinalConfig = parsedConfigOverride;
  } else {
    throw new Error(
      "No config provided: neither config file nor override was found",
    );
  }

  const resolvedFinalConfigResult = v.safeParse(
    ConfigSchema,
    parsedFinalConfig,
  );
  if (!resolvedFinalConfigResult.success) {
    throw new Error(
      `\`${resolveConfig.name}\` failed!` +
        formatValibotIssues(resolvedFinalConfigResult.issues),
    );
  }

  taskLogger.startGroup("Resolved config:");
  taskLogger.info(
    JSON.stringify(resolvedFinalConfigResult.output, jsonValueNormalizer, 2),
  );
  taskLogger.endGroup();

  return {
    rawConfig: rawParsedFinalConfig,
    config: resolvedFinalConfigResult.output,
  };
}

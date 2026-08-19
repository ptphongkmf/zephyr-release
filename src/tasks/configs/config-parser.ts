import { taskLogger } from "../logger.ts";
import type {
  ConfigFileFormat,
  ConfigFileFormatWithAuto,
} from "../../constants/file-formats.ts";
import {
  ConfigFileFormatMap,
  ConfigFileFormats,
} from "../../constants/file-formats.ts";
import {
  detectFileFormatFromPath,
  parseFileString,
} from "../../utils/parsers/file.ts";

/**
 * Get trial order for config file format detection
 */
export function getConfigFormatTrialOrder(
  detectedFormat?: ConfigFileFormat,
): ConfigFileFormat[] {
  const supportedFormats = Object.values(ConfigFileFormats);

  if (!detectedFormat) return supportedFormats;

  return [
    detectedFormat,
    ...supportedFormats.filter((fmt) => fmt !== detectedFormat),
  ];
}

interface ParseConfigResult {
  parsedConfig: object;
  resolvedFormatResult: string;
}

/**
 * Parse config file with auto-detection support
 * @throws
 */
export function parseConfig(
  configStr: string,
  configFormat: ConfigFileFormatWithAuto,
  configPath?: string,
): ParseConfigResult {
  try {
    if (configFormat !== "auto") {
      const parsedConfig = parseFileString(configStr, configFormat);
      return { parsedConfig, resolvedFormatResult: configFormat };
    }

    const detectedFormat = detectFileFormatFromPath(
      configPath,
      ConfigFileFormatMap,
    );
    const trialOrder = getConfigFormatTrialOrder(detectedFormat);

    const triedFormats: string[] = [];

    for (const fmt of trialOrder) {
      triedFormats.push(fmt);

      try {
        const parsedConfig = parseFileString(configStr, fmt);
        const resolvedFormat = `auto -> ${triedFormats.join(" -> ")}`;
        return { parsedConfig, resolvedFormatResult: resolvedFormat };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        taskLogger.startGroup(`Parser error (${fmt})`);
        taskLogger.info(message);
        taskLogger.endGroup();
      }
    }

    // None matched
    throw new Error(
      `None formats matched. Tried order: ${triedFormats.join(" -> ")}`,
    );
  } catch (error) {
    throw new Error(
      `Failed to parse configuration (${configFormat})`,
      { cause: error },
    );
  }
}

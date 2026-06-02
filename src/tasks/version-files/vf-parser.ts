import { taskLogger } from "../logger.ts";
import type { FileFormatWithAuto } from "../../constants/file-formats.ts";
import {
  ConfigFileFormats,
  FileFormatMap,
  FileFormats,
} from "../../constants/file-formats.ts";
import {
  detectFileFormatFromPath,
  isStructuredFileFormat,
  parseFileString,
  type StructuredFileFormat,
} from "../../utils/parsers/file.ts";

/**
 * Get trial order for version file format detection
 */
export function getVersionFileFormatTrialOrder(
  detectedFormat?: StructuredFileFormat,
): StructuredFileFormat[] {
  const supportedFormats = Object.values(ConfigFileFormats);
  const order = detectedFormat
    ? [
      detectedFormat,
      ...supportedFormats.filter((fmt) => fmt !== detectedFormat),
    ]
    : [...supportedFormats];

  return order;
}

interface ParseVersionFileResult {
  parsedContent: unknown;
  resolvedFormatResult: string;
}

/**
 * Parse version file with auto-detection support
 * @throws
 */
export function parseVersionFile(
  fileContent: string,
  fileFormat: FileFormatWithAuto,
  filePath: string,
): ParseVersionFileResult {
  try {
    if (fileFormat !== "auto") {
      if (fileFormat === FileFormats.txt) {
        return { parsedContent: fileContent, resolvedFormatResult: fileFormat };
      }

      if (!isStructuredFileFormat(fileFormat)) {
        throw new Error(
          `Unsupported file format '${fileFormat}' for structured parsing.`,
        );
      }

      const parsedContent = parseFileString(fileContent, fileFormat);
      return { parsedContent, resolvedFormatResult: fileFormat };
    }

    const detectedFormat = detectFileFormatFromPath(filePath, FileFormatMap);

    // If the detected format is plain text, return immediately without structured parsing.
    if (detectedFormat && !isStructuredFileFormat(detectedFormat)) {
      const resolvedFormat = `auto -> ${detectedFormat}`;
      return {
        parsedContent: fileContent,
        resolvedFormatResult: resolvedFormat,
      };
    }

    const trialOrder = getVersionFileFormatTrialOrder(detectedFormat);

    const triedFormats: string[] = [];

    for (const fmt of trialOrder) {
      triedFormats.push(fmt);

      try {
        const parsedContent = parseFileString(fileContent, fmt);
        const resolvedFormat = `auto -> ${triedFormats.join(" -> ")}`;
        return { parsedContent, resolvedFormatResult: resolvedFormat };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        taskLogger.debugWrap((dLogger) => {
          dLogger.startGroup(`Parser error (${fmt})`);
          dLogger.info(message);
          dLogger.endGroup();
        });
      }
    }

    // None matched
    throw new Error(
      `None formats matched. Tried order: ${triedFormats.join(" -> ")}`,
    );
  } catch (error) {
    throw new Error(
      `Failed to parse version file (${fileFormat})`,
      { cause: error },
    );
  }
}

/**
 * Resolve to a structured version file format (json, jsonc, json5, yaml, toml).
 * txt is never returned; when format is "auto", resolution excludes txt.
 * @throws
 */
export function resolveStructuredVersionFileFormat(
  fileContent: string,
  filePath: string,
  format?: FileFormatWithAuto,
): StructuredFileFormat {
  if (format !== undefined && format !== "auto") {
    if (format === FileFormats.txt) {
      throw new Error(
        `Version file '${filePath}' has format "txt" but structured format (json, jsonc, json5, yaml, toml) is required.`,
      );
    }

    if (!isStructuredFileFormat(format)) {
      throw new Error(
        `Unsupported file format '${format}' for structured parsing.`,
      );
    }

    return format;
  }

  const detected = detectFileFormatFromPath(filePath, FileFormatMap);
  const structuredDetected = detected && isStructuredFileFormat(detected)
    ? detected
    : undefined;
  const trialOrder = getVersionFileFormatTrialOrder(structuredDetected);

  for (const fmt of trialOrder) {
    try {
      parseFileString(fileContent, fmt);
      return fmt;
    } catch { /* try next format */ }
  }

  throw new Error(
    `Could not detect structured format for version file '${filePath}'. Tried: ${
      trialOrder.join(", ")
    }`,
  );
}

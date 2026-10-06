import type { SemVer } from "@std/semver";
import type { BumpStrategyConfigResolvedOutput } from "../../schemas/configs/modules/bump-strategy-config.ts";
import { startTime } from "../../main.ts";
import type { BumpRuleExtensionResolvedOutput } from "../../schemas/configs/modules/components/bump-rule-extension.ts";
import type { SemverExtensionResolvedOutput } from "../../schemas/configs/modules/components/semver-extension.ts";
import {
  SemverExtensionDateFormatMap,
  SemverExtensionResetOnOptions,
  SemverExtensionTimestampUnitTypes,
} from "../../constants/semver-extension-options.ts";
import { DateTimeFormatter, nativeJs, ZoneId } from "@js-joda/core";

interface VersionChangeContext {
  majorChanged: boolean;
  minorChanged: boolean;
  patchChanged: boolean;
  prereleaseChanged: boolean;
}

export function calculateNextExtensionsSemVer(
  currentSemVer: SemVer,
  nextCoreSemVer: SemVer,
  strategy: BumpStrategyConfigResolvedOutput,
  baseTimeZone: string,
): SemVer {
  const extensionSemVer = { ...currentSemVer };

  const versionChangeCtx: VersionChangeContext = {
    majorChanged: nextCoreSemVer.major !== currentSemVer.major,
    minorChanged: nextCoreSemVer.minor !== currentSemVer.minor,
    patchChanged: nextCoreSemVer.patch !== currentSemVer.patch,
    prereleaseChanged: false,
  };

  // 1. Prerelease
  if (!strategy.prerelease.enabled) {
    extensionSemVer.prerelease = [];

    versionChangeCtx.prereleaseChanged =
      (currentSemVer.prerelease?.length ?? 0) > 0;
  } else {
    extensionSemVer.prerelease = resolveExtensionList(
      currentSemVer.prerelease,
      strategy.prerelease,
      versionChangeCtx,
      baseTimeZone,
    );

    versionChangeCtx.prereleaseChanged = detectSemVerExtensionSignificantChange(
      currentSemVer.prerelease,
      strategy.prerelease,
    );
  }

  // 2. Build
  if (!strategy.build.enabled) {
    extensionSemVer.build = [];
  } else {
    extensionSemVer.build = resolveExtensionList(
      currentSemVer.build,
      strategy.build,
      versionChangeCtx,
      baseTimeZone,
    );
  }

  return extensionSemVer;
}

/**
 * Detects if a "Significant" change occurred.
 * Per schema: Only triggers on "static" value changes or Add/Remove items.
 * Ignores changes in "dynamic", "incremental", "timestamp", "date".
 */
function detectSemVerExtensionSignificantChange(
  currentSemVerExtensionValues: (string | number)[] | undefined,
  rule: BumpRuleExtensionResolvedOutput,
): boolean {
  const currentExtensions = currentSemVerExtensionValues?.map(String) ?? [];

  if (rule.override) {
    if (rule.treatOverrideAsSignificant) return true;
    else return false;
  }

  const ruleExtensions = rule.extensions ?? [];

  // Length mismatch
  if (currentExtensions.length !== ruleExtensions.length) {
    return true;
  }

  // Check "static" value changes
  for (let i = 0; i < ruleExtensions.length; i++) {
    const item = ruleExtensions[i];
    const val = currentExtensions[i];

    if (item && item.type === "static" && val !== item.value) {
      return true;
    }
  }

  return false;
}

function resolveExtensionList(
  SemVerExtensionValues: (string | number)[] | undefined,
  rule: BumpRuleExtensionResolvedOutput,
  versionChangeCtx: VersionChangeContext,
  baseTimeZone: string,
): string[] {
  const extensions = SemVerExtensionValues?.map(String) ?? [];

  // 1. Check Override
  if (rule.override && rule.override.length > 0) {
    return rule.override;
  }

  // 2. Check Extensions Config
  if (!rule.extensions || rule.extensions.length === 0) {
    return [];
  }

  const resolvedExtensions: string[] = [];

  // Internal structure change for each pre-release/build operation
  let structureChanged = false;

  rule.extensions.forEach((item, index) => {
    const previousValue = extensions[index];

    if (!structureChanged) {
      if (previousValue === undefined) {
        structureChanged = item.type !== "dynamic"; // New item added and it is not "dynamic" type
      } else if (item.type === "static" && previousValue !== item.value) {
        structureChanged = true; // Static label changed
      } else if (
        item.type === "incremental" &&
        (isNaN(Number(previousValue)) || !previousValue.trim())
      ) {
        structureChanged = true; // Type number mismatch
      }

      // Dynamic/Date/Timestamp are considered structurally consistent if they exist
    }

    const resolvedValue = resolveExtensionItem(
      item,
      previousValue,
      versionChangeCtx,
      structureChanged,
      baseTimeZone,
    );

    if (resolvedValue) {
      resolvedExtensions.push(resolvedValue);
    }
  });

  return resolvedExtensions;
}

function resolveExtensionItem(
  item: SemverExtensionResolvedOutput,
  previousValue: string | undefined,
  versionChangeCtx: VersionChangeContext,
  structureChanged: boolean,
  baseTimeZone: string,
): string {
  switch (item.type) {
    case "static":
      return item.value;

    case "dynamic":
      return item.value ?? item.fallbackValue ?? "";

    case "incremental":
      return resolveIncremental(
        item,
        previousValue,
        versionChangeCtx,
        structureChanged,
      );

    case "timestamp": {
      const timeMs = startTime.getTime();

      if (item.unit === SemverExtensionTimestampUnitTypes.s) {
        return Math.floor(timeMs / 1000).toString();
      }
      return timeMs.toString();
    }

    case "date": {
      const targetZoneId = ZoneId.of(item.timeZone ?? baseTimeZone);
      const zonedDateTime = nativeJs(startTime, targetZoneId);
      const pattern = SemverExtensionDateFormatMap[item.format];

      return zonedDateTime.format(DateTimeFormatter.ofPattern(pattern));
    }
  }
}

function resolveIncremental(
  item: Extract<SemverExtensionResolvedOutput, { type: "incremental" }>,
  previousValue: string | undefined,
  versionChangeCtx: VersionChangeContext,
  structureChanged: boolean,
): string {
  let shouldReset = false;

  // Priority A: Structural Change (Internal Cascade)
  if (structureChanged) {
    shouldReset = true;
  } // Priority B: Configured 'reset-on' triggers (External Context)
  else {
    if (
      (item.resetOn.includes(SemverExtensionResetOnOptions.major) &&
        versionChangeCtx.majorChanged) ||
      (item.resetOn.includes(SemverExtensionResetOnOptions.minor) &&
        versionChangeCtx.minorChanged) ||
      (item.resetOn.includes(SemverExtensionResetOnOptions.patch) &&
        versionChangeCtx.patchChanged) ||
      (item.resetOn.includes(SemverExtensionResetOnOptions.prerelease) &&
        versionChangeCtx.prereleaseChanged)
    ) {
      shouldReset = true;
    }
  }

  if (shouldReset) {
    return item.initialValue.toString();
  }

  const v = parseInt(previousValue ?? "", 10);

  if (isNaN(v)) {
    return item.initialValue.toString();
  }

  return (v + 1).toString();
}

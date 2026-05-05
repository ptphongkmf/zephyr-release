import { format, type SemVer } from "@std/semver";
import {
  DateTimeFormatter,
  nativeJs,
  type ZonedDateTime,
  ZoneId,
} from "@js-joda/core";
import type { ConfigOutput } from "../../schemas/configs/config.ts";
import type { PlatformProvider } from "../../types/providers/platform-provider.ts";
import { taskLogger } from "../logger.ts";
import { startTime } from "../../main.ts";
import type {
  DynamicChangelogStringPattern,
  DynamicDatetimeStringPattern,
  FixedBaseStringPattern,
  FixedCurrentVersionStringPattern,
  FixedDatetimeStringPattern,
  FixedNextVersionStringPattern,
  FixedTagStringPattern,
} from "../../types/string-patterns.ts";
import { resolveStringTemplate } from "./resolve-template.ts";
import type { ReviewConfigOutput } from "../../schemas/configs/modules/review-config.ts";
import { jsonValueNormalizer } from "../../utils/transformers/json.ts";

export const STRING_PATTERN_CONTEXT: Record<string, unknown> = {};

// new introduced
const BUILT_IN_CONTEXT: Record<string, unknown> = {};
const CUSTOM_CONTEXT: Record<string, unknown> = {};

export function createCustomStringPatternContext(
  context: ConfigOutput["customStringPatterns"],
): void {
  Object.assign(CUSTOM_CONTEXT, context);
  Object.assign(STRING_PATTERN_CONTEXT, CUSTOM_CONTEXT, BUILT_IN_CONTEXT);

  taskLogger.debug(
    "Custom string pattern context: " + JSON.stringify(CUSTOM_CONTEXT, null, 2),
  );
}

type CreateFixedStrPatCtxConfigParams =
  & Pick<ConfigOutput, "name" | "timeZone">
  & {
    review: Pick<ReviewConfigOutput, "workingBranchNameTemplate">;
  };

export async function createFixedBaseStringPatternContext(
  provider: PlatformProvider,
  triggerBranchName: string,
  config: CreateFixedStrPatCtxConfigParams,
): Promise<void> {
  const { name, timeZone } = config;
  const { workingBranchNameTemplate } = config.review;

  const context = {
    name: name,
    host: provider.getHost(),
    namespace: provider.getNamespace(),
    repository: provider.getRepositoryName(),
    commitPathPart: provider.getCommitPathPart(),
    referencePathPart: provider.getReferencePathPart(),

    triggerBranchName: triggerBranchName,

    timeZone: timeZone,
  } satisfies Omit<
    Record<FixedBaseStringPattern, string | number | undefined>,
    "workingBranchName"
  >;

  Object.assign(BUILT_IN_CONTEXT, context);
  Object.assign(STRING_PATTERN_CONTEXT, CUSTOM_CONTEXT, BUILT_IN_CONTEXT);

  const workingBranchContext = {
    workingBranchName: await resolveStringTemplate(
      workingBranchNameTemplate,
    ),
  } satisfies Pick<Record<FixedBaseStringPattern, string>, "workingBranchName">;

  Object.assign(BUILT_IN_CONTEXT, workingBranchContext);
  Object.assign(STRING_PATTERN_CONTEXT, CUSTOM_CONTEXT, BUILT_IN_CONTEXT);

  taskLogger.debug(
    "Fixed base string pattern context: " +
      JSON.stringify({ ...context, ...workingBranchContext }, null, 2),
  );
}

export function createFixedAndDynamicDatetimeStringPatternContext(
  timeZone: string,
): void {
  const targetZoneId = ZoneId.of(timeZone);
  const fixedZonedDateTime = nativeJs(startTime, targetZoneId);

  function zdtFormat(zdt: ZonedDateTime, pattern: string) {
    return zdt.format(DateTimeFormatter.ofPattern(pattern));
  }

  const fixedContext = {
    timestamp: startTime.getTime(),
    "YYYY": zdtFormat(fixedZonedDateTime, "yyyy"),
    "MM": zdtFormat(fixedZonedDateTime, "MM"),
    "DD": zdtFormat(fixedZonedDateTime, "dd"),
    "HH": zdtFormat(fixedZonedDateTime, "HH"),
    "mm": zdtFormat(fixedZonedDateTime, "mm"),
    "ss": zdtFormat(fixedZonedDateTime, "ss"),
  } satisfies Record<FixedDatetimeStringPattern, string | number | undefined>;

  const dynamicContext = {
    nowTimestamp: () => new Date().getTime(),
    nowYYYY: () => zdtFormat(nativeJs(new Date(), targetZoneId), "yyyy"),
    nowMM: () => zdtFormat(nativeJs(new Date(), targetZoneId), "MM"),
    nowDD: () => zdtFormat(nativeJs(new Date(), targetZoneId), "dd"),
    nowHH: () => zdtFormat(nativeJs(new Date(), targetZoneId), "HH"),
    nowmm: () => zdtFormat(nativeJs(new Date(), targetZoneId), "mm"),
    nowss: () => zdtFormat(nativeJs(new Date(), targetZoneId), "ss"),
  } satisfies Record<DynamicDatetimeStringPattern, () => string | number>;

  Object.assign(BUILT_IN_CONTEXT, fixedContext, dynamicContext);
  Object.assign(STRING_PATTERN_CONTEXT, CUSTOM_CONTEXT, BUILT_IN_CONTEXT);

  taskLogger.debug(
    "Fixed and dynamic datetime string pattern context initialized.",
  );
}

export function createFixedCurrentVersionStringPatternContext(
  currentVersion?: SemVer,
) {
  if (!currentVersion) return;

  const versionContext = {
    currentVersion: format(currentVersion),
    currentVersionCore:
      `${currentVersion.major}.${currentVersion.minor}.${currentVersion.patch}`,
    currentVersionPre: currentVersion?.prerelease?.length
      ? currentVersion.prerelease.join(".")
      : undefined,
    currentVersionBld: currentVersion?.build?.length
      ? currentVersion.build.join(".")
      : undefined,
  } satisfies Record<FixedCurrentVersionStringPattern, string | undefined>;

  Object.assign(BUILT_IN_CONTEXT, versionContext);
  Object.assign(STRING_PATTERN_CONTEXT, CUSTOM_CONTEXT, BUILT_IN_CONTEXT);

  taskLogger.debug(
    "Fixed current version string pattern context: " +
      JSON.stringify(versionContext, null, 2),
  );
}

export function createFixedNextVersionStringPatternContext(
  nextVersion: SemVer,
) {
  const versionContext = {
    nextVersion: format(nextVersion),
    nextVersionCore:
      `${nextVersion.major}.${nextVersion.minor}.${nextVersion.patch}`,
    nextVersionPre: nextVersion.prerelease?.length
      ? nextVersion.prerelease.join(".")
      : undefined,
    nextVersionBld: nextVersion.build?.length
      ? nextVersion.build.join(".")
      : undefined,
  } satisfies Record<FixedNextVersionStringPattern, string | undefined>;

  Object.assign(BUILT_IN_CONTEXT, versionContext);
  Object.assign(STRING_PATTERN_CONTEXT, CUSTOM_CONTEXT, BUILT_IN_CONTEXT);

  taskLogger.debug(
    "Fixed next version string pattern context: " +
      JSON.stringify(versionContext, null, 2),
  );
}

export async function createFixedTagStringPatternContext(
  tagTemplate: string,
) {
  const tagContext = {
    tagName: await resolveStringTemplate(tagTemplate),
  } satisfies Record<FixedTagStringPattern, string>;

  Object.assign(BUILT_IN_CONTEXT, tagContext);
  Object.assign(STRING_PATTERN_CONTEXT, CUSTOM_CONTEXT, BUILT_IN_CONTEXT);

  taskLogger.debug(
    "Fixed tag string pattern context: " +
      JSON.stringify(tagContext, null, 2),
  );
}

export function createDynamicChangelogStringPatternContext(
  changelogRelease?: string,
  changelogReleaseBody?: string,
  changelogReleaseAlt?: string,
  changelogReleaseBodyAlt?: string,
) {
  const context = {
    changelogRelease,
    changelogReleaseBody,
    changelogReleaseAlt,
    changelogReleaseBodyAlt,
  } satisfies Record<DynamicChangelogStringPattern, string | undefined>;

  Object.assign(BUILT_IN_CONTEXT, context);
  Object.assign(STRING_PATTERN_CONTEXT, CUSTOM_CONTEXT, BUILT_IN_CONTEXT);

  taskLogger.debug(
    "Dynamic changelog string pattern context: " +
      JSON.stringify(context, null, 2),
  );
}

export async function stringifyCurrentPatternContext(): Promise<string> {
  const resolvedContext: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(STRING_PATTERN_CONTEXT)) {
    if (typeof value === "function") {
      try {
        const result = await value();
        // If result is not another function, use it; otherwise use original value
        resolvedContext[key] = typeof result !== "function" ? result : value;
      } catch {
        // If function throws, use original value
        resolvedContext[key] = value;
      }
    } else {
      resolvedContext[key] = value;
    }
  }

  // jsonValueNormalizer will catch weird value like BigInt, ...
  return JSON.stringify(resolvedContext, jsonValueNormalizer);
}

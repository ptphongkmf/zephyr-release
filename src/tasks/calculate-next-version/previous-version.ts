import type { SemVer } from "@std/semver";
import type { ConfigOutput } from "../../schemas/configs/config.ts";
import type { InputsOutput } from "../../schemas/inputs/inputs.ts";
import type { PlatformProvider } from "../../types/providers/platform-provider.ts";
import {
  getPrimaryVersionFile,
  getVersionSemVerFromVersionFile,
} from "../version-files/version-file.ts";
import { taskLogger } from "../logger.ts";

type GetCurrentVersionInputsParams = Pick<
  InputsOutput,
  "triggerCommitHash" | "workspacePath" | "sourceMode"
>;

type GetCurrentVersionConfigParams = Pick<
  ConfigOutput,
  "versionFiles"
>;

/** @throws */
export async function getCurrentVersion(
  provider: PlatformProvider,
  inputs: GetCurrentVersionInputsParams,
  config: GetCurrentVersionConfigParams,
  workspaceRelativePath: string = ".",
): Promise<SemVer | undefined> {
  const { triggerCommitHash, workspacePath, sourceMode } = inputs;
  const { versionFiles } = config;

  taskLogger.info("Getting current version from primary version files...");
  const primaryVersionFile = getPrimaryVersionFile(versionFiles);
  const primaryVersion = await getVersionSemVerFromVersionFile(
    primaryVersionFile,
    sourceMode,
    provider,
    workspacePath,
    triggerCommitHash,
    workspaceRelativePath,
  );

  return primaryVersion;
}

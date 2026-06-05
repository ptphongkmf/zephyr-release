import fsPromises from "node:fs/promises";
import fs from "node:fs";
import { contentType } from "@std/media-types";
import { extname } from "@std/path";
import type { TagConfigOutput } from "../schemas/configs/modules/tag-config.ts";
import type { ReleaseConfigOutput } from "../schemas/configs/modules/release-config.ts";
import type { InputsOutput } from "../schemas/inputs/inputs.ts";
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import { getTextFile } from "./file.ts";
import { taskLogger } from "./logger.ts";
import { resolveStringTemplate } from "./string-templates-and-patterns/resolve-template.ts";
import type { StringPatternContext } from "./string-templates-and-patterns/pattern-context.ts";
import { failedNonCriticalTasks } from "../main.ts";
import { basename } from "@std/path";
import { consumeAsyncIterable } from "../utils/async.ts";
import { pooledMap } from "@std/async";

type CreateReleaseInputsParams = Pick<
  InputsOutput,
  "triggerCommitHash" | "workspacePath" | "sourceMode"
>;

interface CreateReleaseConfigParams {
  tag: Pick<TagConfigOutput, "nameTemplate">;
  release: Pick<
    ReleaseConfigOutput,
    | "prerelease"
    | "draft"
    | "setLatest"
    | "titleTemplate"
    | "titleTemplatePath"
    | "headerTemplate"
    | "headerTemplatePath"
    | "bodyTemplate"
    | "bodyTemplatePath"
    | "footerTemplate"
    | "footerTemplatePath"
  >;
}

/** @throws */
export async function createRelease(
  provider: PlatformProvider,
  inputs: CreateReleaseInputsParams,
  config: CreateReleaseConfigParams,
  patternContext: StringPatternContext,
) {
  const { triggerCommitHash, workspacePath, sourceMode } = inputs;
  const { tag } = config;
  const {
    prerelease,
    draft,
    setLatest,
    titleTemplate,
    titleTemplatePath,
    headerTemplate,
    headerTemplatePath,
    bodyTemplate,
    bodyTemplatePath,
    footerTemplate,
    footerTemplatePath,
  } = config.release;

  let releaseNoteTitle: string | undefined;
  if (titleTemplatePath) {
    const releaseTitleTemplate = await getTextFile(
      sourceMode.overrides?.[titleTemplatePath] ?? sourceMode.mode,
      titleTemplatePath,
      { provider, workspacePath, ref: triggerCommitHash },
    );
    releaseNoteTitle = await resolveStringTemplate(releaseTitleTemplate, patternContext);
  } else {
    releaseNoteTitle = await resolveStringTemplate(titleTemplate, patternContext);
  }

  let releaseNoteHeader: string | undefined;
  if (headerTemplatePath) {
    const releaseHeaderTemplate = await getTextFile(
      sourceMode.overrides?.[headerTemplatePath] ?? sourceMode.mode,
      headerTemplatePath,
      { provider, workspacePath, ref: triggerCommitHash },
    );
    releaseNoteHeader = await resolveStringTemplate(releaseHeaderTemplate, patternContext);
  } else if (headerTemplate !== undefined) {
    releaseNoteHeader = await resolveStringTemplate(headerTemplate, patternContext);
  }

  let releaseNoteBody: string | undefined;
  if (bodyTemplatePath) {
    const releaseBodyTemplate = await getTextFile(
      sourceMode.overrides?.[bodyTemplatePath] ?? sourceMode.mode,
      bodyTemplatePath,
      { provider, workspacePath, ref: triggerCommitHash },
    );
    releaseNoteBody = await resolveStringTemplate(releaseBodyTemplate, patternContext);
  } else {
    releaseNoteBody = await resolveStringTemplate(bodyTemplate, patternContext);
  }

  let releaseNoteFooter: string | undefined;
  if (footerTemplatePath) {
    const releaseFooterTemplate = await getTextFile(
      sourceMode.overrides?.[footerTemplatePath] ?? sourceMode.mode,
      footerTemplatePath,
      { provider, workspacePath, ref: triggerCommitHash },
    );
    releaseNoteFooter = await resolveStringTemplate(releaseFooterTemplate, patternContext);
  } else if (footerTemplate !== undefined) {
    releaseNoteFooter = await resolveStringTemplate(footerTemplate, patternContext);
  }

  const fullReleaseBody = [
    releaseNoteHeader,
    releaseNoteBody,
    releaseNoteFooter,
  ]
    .filter(Boolean)
    .join("\n\n");

  const createdRelease = await provider.createRelease(
    await resolveStringTemplate(tag.nameTemplate, patternContext),
    releaseNoteTitle,
    fullReleaseBody,
    { prerelease, draft, setLatest },
  );
  taskLogger.info(`Release created: ${createdRelease.url}`);

  return createdRelease;
}

export async function attachReleaseAssets(
  provider: PlatformProvider,
  releaseId: string | number,
  assetPaths: string[],
) {
  try {
    const MAX_CONCURRENT_UPLOADS = 5;

    taskLogger.info(
      `Preparing to attach ${assetPaths.length} assets (${MAX_CONCURRENT_UPLOADS} concurrent uploads allowed)...`,
    );

    // Pre-fetch sizes without reading files into memory
    const uploadTargets = await Promise.all(
      assetPaths.map(async (path) => {
        const fileStat = await fsPromises.stat(path);
        if (!fileStat.isFile()) {
          taskLogger.info(`Skipping ${path}: Not a file`);
          return null;
        }

        return {
          filePath: path,
          fileName: basename(path),
          sizeBytes: fileStat.size,
        };
      }),
    );

    const filteredUploadTargets = uploadTargets.filter((
      t,
    ): t is NonNullable<typeof t> => Boolean(t));

    await consumeAsyncIterable(
      pooledMap(
        MAX_CONCURRENT_UPLOADS,
        filteredUploadTargets,
        async (target) => {
          const sizeMb = (target.sizeBytes / 1024 / 1024).toFixed(2);
          taskLogger.info(`↑ Uploading: ${target.fileName} (${sizeMb} MB)`);

          await provider.attachReleaseAsset(
            String(releaseId),
            {
              name: target.fileName,
              bytes: target.sizeBytes,
              contentType: contentType(extname(target.filePath)) ??
                "application/octet-stream",
              createDataStream: () => fs.createReadStream(target.filePath),
            },
          );
        },
      ),
    );
  } catch (error) {
    const message = `Failed to attach release assets: ${
      error instanceof Error ? error.message : String(error)
    }`;

    taskLogger.warn(message);
    failedNonCriticalTasks.push(message);
  }
}

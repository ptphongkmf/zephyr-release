import { getTextFile } from "./file.ts";
import { resolveStringTemplate } from "./string-templates-and-patterns/resolve-template.ts";
import { TaggerDateOptions } from "../constants/release-tag-options.ts";
import type { TagConfigOutput } from "../schemas/configs/modules/tag-config.ts";
import type { InputsOutput } from "../schemas/inputs/inputs.ts";
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import type { TaggerRequest } from "../types/tag.ts";

type CreateTagInputsParams = Pick<
  InputsOutput,
  "triggerCommitHash" | "workspacePath" | "sourceMode"
>;

interface CreateTagConfigParams {
  tag: Pick<
    TagConfigOutput,
    | "nameTemplate"
    | "type"
    | "messageTemplate"
    | "messageTemplatePath"
    | "tagger"
  >;
}

/** @throws */
export async function createTag(
  provider: PlatformProvider,
  targetCommitHash: string,
  inputs: CreateTagInputsParams,
  config: CreateTagConfigParams,
) {
  const { triggerCommitHash, workspacePath, sourceMode } = inputs;
  const {
    nameTemplate,
    type,
    messageTemplate,
    messageTemplatePath,
    tagger,
  } = config.tag;

  let tagMessage: string | undefined;
  if (messageTemplatePath) {
    const msgTemplate = await getTextFile(
      sourceMode.overrides?.[messageTemplatePath] ?? sourceMode.mode,
      messageTemplatePath,
      { provider, workspacePath: workspacePath, ref: triggerCommitHash },
    );
    tagMessage = await resolveStringTemplate(msgTemplate);
  } else {
    tagMessage = await resolveStringTemplate(messageTemplate);
  }

  let taggerData: TaggerRequest | undefined;
  if (tagger) {
    let taggerDate: string | undefined;
    if (tagger.date) {
      switch (tagger.date) {
        case TaggerDateOptions.now:
          taggerDate = new Date().toISOString();
          break;
        case TaggerDateOptions.commitDate: {
          const commitData = await provider.getCommit(targetCommitHash);
          taggerDate = commitData.committer.date.toString();
          break;
        }
        case TaggerDateOptions.authorDate: {
          const commitData = await provider.getCommit(targetCommitHash);
          taggerDate = commitData.author.date.toString();
          break;
        }

        default:
          taggerDate = new Date(tagger.date).toISOString();
          break;
      }
    }

    taggerData = {
      name: tagger.name,
      email: tagger.email,
      date: taggerDate,
    };
  }

  return await provider.createTag(
    await resolveStringTemplate(nameTemplate),
    targetCommitHash,
    type,
    tagMessage,
    taggerData,
  );
}

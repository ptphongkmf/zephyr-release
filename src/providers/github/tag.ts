import {
  githubGetHost,
  githubGetNamespace,
  githubGetRepositoryName,
} from "./repository.ts";
import type { GetOctokitFn, OctokitClient } from "./octokit.ts";
import { joinUrlSegments } from "../../utils/transformers/url.ts";
import type { TaggerRequest } from "../../types/tag.ts";
import type {
  ProviderMatchedTag,
  ProviderTag,
} from "../../types/providers/tag.ts";
import type { TagTypeOption } from "../../constants/release-tag-options.ts";
import { execFileAsync } from "../../utils/child-process.ts";
import process from "node:process";

export function githubGetCompareTagUrl(tag1: string, tag2: string): string {
  const compareSegment = tag1 + "..." + tag2;

  return new URL(
    joinUrlSegments(
      githubGetNamespace(),
      githubGetRepositoryName(),
      "compare",
      compareSegment,
    ),
    githubGetHost(),
  ).href;
}

async function githubGetCompareTagUrlFromCurrentToLatest(
  octokit: OctokitClient,
  currentTag: string,
  skip: number = 0,
): Promise<string> {
  if (skip < 0) {
    throw new Error(`Skip value cannot be a negative number: ${skip}`);
  }

  const paginatedIterator = octokit.paginate.iterator(
    octokit.rest.repos.listTags,
    {
      owner: githubGetNamespace(),
      repo: githubGetRepositoryName(),
      per_page: skip + 1 < 100 ? skip + 1 : 100,
    },
  );

  const tags: string[] = [];

  for await (const res of paginatedIterator) {
    for (const tag of res.data) {
      tags.push(tag.name);

      // Stop as soon as we have enough tags to satisfy the skip
      if (tags.length > skip) break;
    }
    if (tags.length > skip) break;
  }

  const targetTag = tags[skip];
  if (!targetTag) {
    if (tags.length === 0) {
      // First release - no prior tags exist to compare against, return plain text.
      return currentTag;
    }
    throw new Error(
      `Cannot skip ${skip} tag(s) from latest; repository only contains ${tags.length} tag(s) total`,
    );
  }

  return new URL(
    joinUrlSegments(
      githubGetNamespace(),
      githubGetRepositoryName(),
      "compare",
      targetTag + "..." + currentTag,
    ),
    githubGetHost(),
  ).href;
}

/** @throws */
async function githubFindLastReleaseTag(
  octokit: OctokitClient,
  matchPatterns: RegExp[],
  maxTagsToScan: number = 100,
): Promise<ProviderMatchedTag | undefined> {
  let scanned = 0;
  const tagsIterator = octokit.paginate.iterator(
    octokit.rest.repos.listTags,
    {
      owner: githubGetNamespace(),
      repo: githubGetRepositoryName(),
      per_page: 100,
    },
  );

  for await (const response of tagsIterator) {
    for (const tag of response.data) {
      if (matchPatterns.some((p) => p.test(tag.name))) {
        return { hash: tag.commit.sha, tagName: tag.name };
      }
      scanned++;
      if (scanned >= maxTagsToScan) return undefined;
    }
  }

  return undefined;
}

/** @throws */
async function githubCreateTag(
  octokit: OctokitClient,
  tagName: string,
  commitHash: string,
  tagType: TagTypeOption,
  message: string,
  tagger?: TaggerRequest,
): Promise<ProviderTag> {
  const owner = githubGetNamespace();
  const repo = githubGetRepositoryName();

  let finalHash = commitHash;

  if (tagType === "signed") {
    const cliEnv = { ...process.env };

    if (tagger) {
      cliEnv.GIT_COMMITTER_NAME = tagger.name;
      cliEnv.GIT_COMMITTER_EMAIL = tagger.email;
      if (tagger.date) cliEnv.GIT_COMMITTER_DATE = tagger.date;
    }

    await execFileAsync("git", [
      "tag",
      "-s",
      tagName,
      commitHash,
      "-m",
      message,
    ], {
      env: cliEnv,
    });

    await execFileAsync("git", ["push", "origin", `refs/tags/${tagName}`]);

    const { stdout } = await execFileAsync("git", ["rev-parse", tagName]);
    finalHash = stdout.trim();

    return { name: tagName, hash: finalHash, targetHash: commitHash };
  } else {
    if (tagType === "annotated") {
      const tagRes = await octokit.rest.git.createTag({
        owner: owner,
        repo: repo,
        tag: tagName,
        message: message,
        object: commitHash,
        type: "commit",
        tagger: tagger,
      });

      finalHash = tagRes.data.sha;
    }

    await octokit.rest.git.createRef({
      owner: owner,
      repo: repo,
      ref: "refs/tags/" + tagName,
      sha: finalHash,
    });

    return { name: tagName, hash: finalHash, targetHash: commitHash };
  }
}

export function makeGithubGetCompareTagUrlFromCurrentToLatest(
  getOctokit: GetOctokitFn,
) {
  return (currentTag: string, skip?: number) =>
    githubGetCompareTagUrlFromCurrentToLatest(
      getOctokit(),
      currentTag,
      skip,
    );
}

export function makeGithubFindLastReleaseTag(getOctokit: GetOctokitFn) {
  return (matchPatterns: RegExp[], maxTagsToScan?: number) =>
    githubFindLastReleaseTag(getOctokit(), matchPatterns, maxTagsToScan);
}

export function makeGithubCreateTag(getOctokit: GetOctokitFn) {
  return (
    tagName: string,
    commitHash: string,
    tagType: TagTypeOption,
    message: string,
    tagger?: TaggerRequest,
  ) =>
    githubCreateTag(
      getOctokit(),
      tagName,
      commitHash,
      tagType,
      message,
      tagger,
    );
}

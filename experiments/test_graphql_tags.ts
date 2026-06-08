import { getOctokit } from "../src/providers/github/octokit.ts";
import { githubGetNamespace, githubGetRepositoryName } from "../src/providers/github/repository.ts";
import * as dotenv from "dotenv";

dotenv.config();

const octokit = getOctokit(process.env.GITHUB_TOKEN || "");
const owner = "ptphongkmf"; // Replace with actual
const repo = "zephyr-release";

async function test() {
  const query = `
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        refs(refPrefix: "refs/tags/", first: 10, orderBy: {field: TAG_COMMIT_DATE, direction: DESC}) {
          nodes {
            name
            target {
              __typename
              oid
              ... on Tag {
                tagger { date }
                target { oid }
              }
              ... on Commit {
                authoredDate
                committedDate
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await octokit.graphql(query, { owner, repo });
    console.log(JSON.stringify(response, null, 2));
  } catch (err) {
    console.error(err);
  }
}

test();

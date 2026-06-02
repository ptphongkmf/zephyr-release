import process from "node:process";
import type { PlatformProvider } from "../types/providers/platform-provider.ts";

/** @throws */
export async function getProvider(): Promise<PlatformProvider> {
  if (process.env.GITHUB_ACTIONS === "true") {
    const { createGitHubProvider } = await import(
      "./github/github-provider.ts"
    );
    return createGitHubProvider();
  }

  // TODO: if requested enough
  //
  // if (process.env.GITLAB_CI === "true") {
  //   return "gitlab";
  // }

  // TODO(local): support local execution for development (e.g. fallback provider)

  throw new Error(
    "Unsupported execution environment - no supported platform detected",
  );
}

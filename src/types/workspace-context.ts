import type { ConfigOutput } from "../schemas/configs/config.ts";

export interface ResolvedWorkspace {
  /** Relative path from repo root */
  path: string;
  /** Fully merged config (root defaults + workspace overrides) */
  config: ConfigOutput;
  /** Whether this is a workspace member (true) or root/single-repo (false) */
  isWorkspace: boolean;
}

import type { ConfigOutput } from "../schemas/configs/config.ts";

export interface ResolvedWorkspace {
  /** Relative path from repo root */
  path: string;
  /** Fully merged config (root defaults + workspace overrides) */
  config: ConfigOutput;
}

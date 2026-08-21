import type { ConfigOutput } from "./config.ts";
import { toKebabCase } from "@std/text/to-kebab-case";
import { toSnakeCase } from "@std/text/to-snake-case";

const PATHS = [
  "workspace" satisfies keyof ConfigOutput,
];

export const CONFIG_PRESERVE_KEYS_AT_PATH = [
  PATHS.join("."),
  PATHS.map(toKebabCase).join("."),
  PATHS.map(toSnakeCase).join("."),
];

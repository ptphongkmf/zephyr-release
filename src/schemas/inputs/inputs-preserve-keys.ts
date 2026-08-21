import type { InputsOutput } from "./inputs.ts";
import { toKebabCase } from "@std/text/to-kebab-case";
import { toSnakeCase } from "@std/text/to-snake-case";

const PATHS = [
  "sourceMode" satisfies keyof InputsOutput,
  "overrides" satisfies keyof InputsOutput["sourceMode"],
];

export const INPUTS_PRESERVE_KEYS_AT_PATH = [
  PATHS.join("."),
  PATHS.map(toKebabCase).join("."),
  PATHS.map(toSnakeCase).join("."),
];

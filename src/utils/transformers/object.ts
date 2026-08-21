import { toCamelCase, toKebabCase } from "@std/text";
import { map } from "obj-walker";
import { isPlainObject, isPlainObjectOrArray } from "../validations/object.ts";

export interface TransformObjKeyOptions {
  mutate?: boolean;
  /** Key names that are never transformed, wherever in the tree they appear. */
  excludeKeys?: string[];
  /** Dot-joined paths (from root) whose OWN keys are left untransformed. Descendants are still processed normally. */
  preserveKeysAtPaths?: readonly string[];
}

function transformObjKeyCase(
  obj: unknown,
  caseFn: (key: string) => string,
  options?: TransformObjKeyOptions,
): object {
  if (!isPlainObjectOrArray(obj)) {
    throw new Error(
      "TransformObjKeyCase Error: expected a plain object or array input",
    );
  }

  const preservePaths = new Set(options?.preserveKeysAtPaths);

  return map(
    obj,
    ({ val, path }) => {
      if (!isPlainObject(val)) return val;
      if (preservePaths.has(path.join("."))) return val;

      return Object.fromEntries(
        Object.entries(val).map(([k, v]) => [
          options?.excludeKeys?.includes(k) ? k : caseFn(k),
          v,
        ]),
      );
    },
    {
      postOrder: true,
      modifyInPlace: options?.mutate ?? false,
    },
  );
}

export function transformObjKeyToKebabCase(
  obj: unknown,
  options?: TransformObjKeyOptions,
): object {
  return transformObjKeyCase(
    obj,
    toKebabCase,
    options,
  );
}

export function transformObjKeyToCamelCase(
  obj: unknown,
  options?: TransformObjKeyOptions,
): object {
  return transformObjKeyCase(
    obj,
    toCamelCase,
    options,
  );
}

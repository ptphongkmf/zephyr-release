export function isPlainObject(
  input: unknown,
): input is Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }

  const proto = Object.getPrototypeOf(input);
  return proto === Object.prototype || proto === null;
}

export function isPlainObjectOrArray(
  input: unknown,
): input is Record<string, unknown> | unknown[] {
  if (input === null || typeof input !== "object") {
    return false;
  }

  if (Array.isArray(input)) {
    return true;
  }

  const proto = Object.getPrototypeOf(input);
  return proto === Object.prototype || proto === null;
}

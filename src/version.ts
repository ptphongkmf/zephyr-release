import denoJson from "../deno.json" with { type: "json" };

/**
 * Mirrors deno.json { version }.
 */
export const VERSION = denoJson.version;

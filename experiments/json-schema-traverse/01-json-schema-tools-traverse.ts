/**
 * EXPERIMENT 01: @json-schema-tools/traverse@1.15.1
 * RESULT: FAILED
 *
 * Conclusion:
 * Even after upgrading to 1.15.1, @json-schema-tools/traverse skips ALL of:
 *   - `if`
 *   - `then`
 *   - `else`
 *   - `not`
 *   - `$defs` subschemas (it only knows Draft-04/07 `definitions`, not `$defs`)
 *
 * Verified visited paths:
 *   ["$.anyOf[0]", "$.properties.versionFiles.properties.filePath",
 *    "$.properties.versionFiles", "$.properties.timeZone",
 *    "$.properties.workspace.additionalProperties.properties.versionFiles",
 *    "$.properties.workspace.additionalProperties",
 *    "$.properties.workspace.propertyNames", "$.properties.workspace", "$"]
 *
 * Result after kebab transform:
 *   - if:   {"not":{"required":["workspace"]}}          (NOT visited)
 *   - then: {"required":["versionFiles"]}               (NOT visited -> stayed camelCase)
 *   - else: {"properties":{"versionFiles":false}}       (NOT visited -> stayed camelCase)
 *   - $defs.time-zone: required:["zoneName"]            (inner subschema NOT visited)
 */

// import traverse from "@json-schema-tools/traverse";
// import { toKebabCase } from "@std/text";
//
// const sampleSchema = {
//   $schema: "http://json-schema.org/draft-07/schema#",
//   type: "object",
//   properties: {
//     versionFiles: {
//       type: "object",
//       properties: {
//         filePath: { type: "string", description: "Uses `versionFiles.filePath`" },
//       },
//       required: ["filePath"],
//     },
//     timeZone: { $ref: "#/$defs/timeZone" },
//     workspace: {
//       type: "object",
//       propertyNames: { type: "string", minLength: 1 },
//       additionalProperties: {
//         type: "object",
//         properties: {
//           versionFiles: { type: "string" },
//         },
//         required: ["versionFiles"],
//       },
//     },
//   },
//   anyOf: [{ required: ["versionFiles"] }],
//   if: {
//     not: {
//       required: ["workspace"],
//     },
//   },
//   then: {
//     required: ["versionFiles"],
//   },
//   else: {
//     properties: {
//       versionFiles: false,
//     },
//   },
//   $defs: {
//     timeZone: {
//       type: "string",
//       properties: {
//         zoneName: { type: "string" },
//       },
//       required: ["zoneName"],
//     },
//   },
// };
//
// const visitedPaths: string[] = [];
// const schema = structuredClone(sampleSchema);
//
// traverse.default(
//   schema as any,
//   (sub: unknown, _isCycle: boolean, path: string) => {
//     visitedPaths.push(path);
//     if (sub && typeof sub === "object") {
//       const s = sub as Record<string, unknown>;
//       if (s.$defs && typeof s.$defs === "object") {
//         s.$defs = Object.fromEntries(
//           Object.entries(s.$defs).map(([k, v]) => [toKebabCase(k), v]),
//         );
//       }
//       if (s.properties && typeof s.properties === "object") {
//         s.properties = Object.fromEntries(
//           Object.entries(s.properties).map(([k, v]) => [toKebabCase(k), v]),
//         );
//       }
//       if (
//         Array.isArray(s.required) &&
//         s.required.every((x) => typeof x === "string")
//       ) {
//         s.required = s.required.map((x) => toKebabCase(x));
//       }
//     }
//     return sub as any;
//   },
//   { mutable: true },
// );
//
// console.log("=== @json-schema-tools/traverse@1.15.1 ===");
// console.log("Visited paths:", visitedPaths);
// console.log("if:", JSON.stringify(schema.if));
// console.log("then:", JSON.stringify(schema.then));
// console.log("else:", JSON.stringify(schema.else));
// console.log("$defs keys:", Object.keys(schema.$defs));
// console.log("$defs.time-zone:", JSON.stringify((schema.$defs as any)["time-zone"]));
// console.log("anyOf:", JSON.stringify(schema.anyOf));

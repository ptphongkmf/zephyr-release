/**
 * EXPERIMENT 02: json-schema-traverse@1.0.0 (by epoberezkin / Ajv)
 * RESULT: PASSED TECHNICALLY, NOT ADOPTED
 *
 * Conclusion:
 * - Visits `if`, `then`, `else`, `not`, `$defs`, `anyOf`, `propertyNames`,
 *   `additionalProperties`, and preserves `default` data out of the box.
 * - Not adopted because `json-schema-traverse@1.0.0` has not been updated in ~6 years
 *   and lacks Draft 2019-09 / 2020-12 keywords (`prefixItems`, `dependentSchemas`,
 *   `unevaluatedProperties`, `unevaluatedItems`, `contentSchema`), while
 *   `@json-schema-tools/traverse` has active upstream work to add native support.
 * - Commented out after removing `json-schema-traverse` from `deno.json`.
 */

// import traverse from "json-schema-traverse";
// import { toKebabCase } from "@std/text";
//
// const sampleSchema = {
//   $schema: "http://json-schema.org/draft-07/schema#",
//   type: "object",
//   properties: {
//     versionFiles: {
//       type: "object",
//       properties: {
//         filePath: {
//           type: "string",
//           description: "Uses `versionFiles.filePath` and `timeZone`",
//         },
//       },
//       required: ["filePath"],
//     },
//     timeZone: { $ref: "#/$defs/timeZone" },
//     commitTypes: {
//       type: "array",
//       default: [
//         {
//           type: "feat",
//           description: "Should NOT be touched `versionFiles`",
//           required: ["keepCamelCase"],
//         },
//       ],
//     },
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
//       type: "object",
//       properties: {
//         zoneName: { type: "string" },
//       },
//       required: ["zoneName"],
//     },
//   },
// };
//
// const visitedPointers: string[] = [];
// const schema = structuredClone(sampleSchema);
// const propertyMap = new Map<string, string>();
//
// traverse(schema, {
//   cb: {
//     post(sub: Record<string, unknown>, jsonPtr: string) {
//       visitedPointers.push(jsonPtr || "(root)");
//
//       if (sub.$defs && typeof sub.$defs === "object") {
//         sub.$defs = Object.fromEntries(
//           Object.entries(sub.$defs).map(([k, v]) => [toKebabCase(k), v]),
//         );
//       }
//
//       if (typeof sub.$ref === "string" && sub.$ref.startsWith("#")) {
//         const parts = sub.$ref.split("/");
//         const last = parts.at(-1);
//         if (last) {
//           parts[parts.length - 1] = toKebabCase(last);
//           sub.$ref = parts.join("/");
//         }
//       }
//
//       if (sub.properties && typeof sub.properties === "object") {
//         sub.properties = Object.fromEntries(
//           Object.entries(sub.properties).map(([k, v]) => {
//             const cased = toKebabCase(k);
//             propertyMap.set(k, cased);
//             return [cased, v];
//           }),
//         );
//       }
//
//       if (
//         Array.isArray(sub.required) &&
//         sub.required.every((x) => typeof x === "string")
//       ) {
//         sub.required = sub.required.map((x) => toKebabCase(x));
//       }
//     },
//   },
// });
//
// traverse(schema, (sub: Record<string, unknown>) => {
//   if (typeof sub.description === "string") {
//     sub.description = sub.description.replace(
//       /`([^`]+)`/g,
//       (_m, content: string) =>
//         "`" +
//         content
//           .split(".")
//           .map((part) => propertyMap.get(part) ?? part)
//           .join(".") +
//         "`",
//     );
//   }
// });
//
// console.log("=== json-schema-traverse@1.0.0 ===");
// console.log("Visited pointers:", visitedPointers);
// console.log("if:", JSON.stringify(schema.if));
// console.log("then:", JSON.stringify(schema.then));
// console.log("else:", JSON.stringify(schema.else));
// console.log("$defs:", JSON.stringify(schema.$defs));
// console.log(
//   "timeZone $ref:",
//   JSON.stringify((schema.properties as any)["time-zone"]),
// );
// console.log("anyOf:", JSON.stringify(schema.anyOf));
// console.log(
//   "filePath description:",
//   (schema.properties as any)["version-files"].properties["file-path"]
//     .description,
// );
// console.log(
//   "default data preserved:",
//   JSON.stringify((schema.properties as any)["commit-types"].default),
// );

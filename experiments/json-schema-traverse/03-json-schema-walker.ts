/**
 * EXPERIMENT 03: json-schema-walker@4.0.0
 * RESULT: FAILED
 *
 * Conclusion:
 * - Visits `if`, `then`, `else`, `not` and preserves `default` data under `DRAFT_07`.
 * - FAILS on `$defs` subschemas: its built-in vocabularies (`DRAFT_04`, `DRAFT_06`,
 *   `DRAFT_07`) only recognize `definitions`, not `$defs` (which `@valibot/to-json-schema`
 *   emits). Inner properties/required inside `$defs` were skipped:
 *     $defs: {"time-zone":{"type":"object","properties":{"zoneName":{"type":"string"}},"required":["zoneName"]}}
 * - Also heavier than needed: pulls in `@apidevtools/json-schema-ref-parser` and
 *   `@types/json-schema`, pre-order only (no `post` hook), and requires class setup
 *   (`new Walker()`, `loadSchemaSync()`, `walkSync()`).
 */

// import { Walker } from "json-schema-walker";
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
//     commitTypes: {
//       type: "array",
//       default: [
//         { type: "feat", description: "Should NOT be touched `versionFiles`", required: ["keepCamelCase"] },
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
// const walker = new Walker<any>();
// walker.loadSchemaSync(sampleSchema, { cloneSchema: true });
//
// walker.walkSync(
//   (sub: any) => {
//     if (sub && typeof sub === "object") {
//       if (sub.$defs && typeof sub.$defs === "object") {
//         sub.$defs = Object.fromEntries(
//           Object.entries(sub.$defs).map(([k, v]) => [toKebabCase(k), v]),
//         );
//       }
//       if (sub.properties && typeof sub.properties === "object") {
//         sub.properties = Object.fromEntries(
//           Object.entries(sub.properties).map(([k, v]) => [toKebabCase(k), v]),
//         );
//       }
//       if (
//         Array.isArray(sub.required) &&
//         sub.required.every((x: unknown) => typeof x === "string")
//       ) {
//         sub.required = sub.required.map((x: string) => toKebabCase(x));
//       }
//     }
//   },
//   walker.vocabularies.DRAFT_07,
// );
//
// const schema = walker.rootSchema;
// console.log("=== json-schema-walker@4.0.0 (DRAFT_07) ===");
// console.log("if:", JSON.stringify(schema.if));
// console.log("then:", JSON.stringify(schema.then));
// console.log("else:", JSON.stringify(schema.else));
// console.log("$defs:", JSON.stringify(schema.$defs));
// console.log("anyOf:", JSON.stringify(schema.anyOf));
// console.log(
//   "default data preserved:",
//   JSON.stringify(schema.properties["commit-types"].default),
// );

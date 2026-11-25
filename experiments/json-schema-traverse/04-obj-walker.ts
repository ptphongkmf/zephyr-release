/**
 * EXPERIMENT 04: obj-walker@2.5.0 (generic object walker already in deno.json)
 * RESULT: FAILED
 *
 * Conclusion:
 * - Visits every nested object including `if`, `then`, `else`, `not`, and `$defs`.
 * - FAILS on JSON Schema vocabulary safety: because it walks all plain objects
 *   blindly, it descends into data keywords (`default`, `examples`, `const`, `enum`)
 *   and corrupts user data values that happen to share schema keyword names.
 * - Verified corruption on `commitTypes.default`:
 *     Input:  [{"type":"feat","description":"Should NOT be touched `versionFiles`","required":["keepCamelCase"]}]
 *     Output: [{"type":"feat","description":"Should NOT be touched `versionFiles`","required":["keep-camel-case"]}]
 * - Avoiding this requires manually re-implementing JSON Schema keyword filtering
 *   on top of `obj-walker`, which is worse than using `json-schema-traverse`.
 */

// import { map } from "obj-walker";
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
//     commitTypes: {
//       type: "array",
//       default: [
//         { type: "feat", description: "Should NOT be touched `versionFiles`", required: ["keepCamelCase"] },
//       ],
//     },
//   },
//   if: { not: { required: ["workspace"] } },
//   then: { required: ["versionFiles"] },
//   else: { properties: { versionFiles: false } },
//   $defs: {
//     timeZone: {
//       type: "object",
//       properties: { zoneName: { type: "string" } },
//       required: ["zoneName"],
//     },
//   },
// };
//
// const schema = map(
//   structuredClone(sampleSchema),
//   ({ val }) => {
//     if (val && typeof val === "object" && !Array.isArray(val)) {
//       const s = val as Record<string, unknown>;
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
//     return val;
//   },
//   { postOrder: true },
// ) as any;
//
// console.log("=== obj-walker@2.5.0 (generic walker) ===");
// console.log("if:", JSON.stringify(schema.if));
// console.log("then:", JSON.stringify(schema.then));
// console.log("else:", JSON.stringify(schema.else));
// console.log("$defs:", JSON.stringify(schema.$defs));
// console.log(
//   "default data (BUG if keep-camel-case!):",
//   JSON.stringify(schema.properties["commit-types"].default),
// );

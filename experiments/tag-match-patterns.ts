import picomatch from "picomatch";
import {
  buildMatchPatterns,
  templateToMatchPattern,
} from "../src/tasks/string-templates-and-patterns/match-patterns.ts";

console.log("=== templateToMatchPattern ===\n");

const templateCases = [
  { input: "v{{ nextVersion }}", expected: "v*" },
  { input: "{{ name }}-v{{ nextVersion }}", expected: "*-v*" },
  {
    input: "release/{{ name }}/v{{ nextVersion }}",
    expected: "release/*/v*",
  },
  { input: "{{ name | upcase }}-v{{ nextVersion }}", expected: "*-v*" },
  { input: "plain-tag", expected: "plain-tag" },
];

for (const { input, expected } of templateCases) {
  const result = templateToMatchPattern(input);
  const pass = result === expected;
  console.log(
    `  templateToMatchPattern("${input}") => "${result}" ${
      pass ? "✅" : `❌ expected "${expected}"`
    }`,
  );
}

console.log("\n=== picomatch.makeRe ===\n");

const globCases = [
  { glob: "v*", tag: "v1.2.3", expected: true },
  { glob: "v*", tag: "release-1.2.3", expected: false },
  { glob: "*-v*", tag: "core-v1.2.3", expected: true },
  { glob: "*-v*", tag: "v1.2.3", expected: false },
  { glob: "release-*", tag: "release-2.0.0", expected: true },
  { glob: "release-*", tag: "v2.0.0", expected: false },
  { glob: "v*", tag: "v0.0.1-alpha.1", expected: true },
  { glob: "plain-tag", tag: "plain-tag", expected: true },
  { glob: "plain-tag", tag: "not-plain-tag", expected: false },
];

for (const { glob, tag, expected } of globCases) {
  const regex = picomatch.makeRe(glob);
  const result = regex.test(tag);
  const pass = result === expected;
  console.log(
    `  picomatch.makeRe("${glob}").test("${tag}") => ${result} ${
      pass ? "✅" : `❌ expected ${expected}`
    }`,
  );
}

console.log("\n=== buildMatchPatterns ===\n");

// Test 1: No user patterns — auto-derived only
const p1 = buildMatchPatterns("v{{ nextVersion }}");
console.log(`  Auto-derived only (1 pattern): ${p1.length} patterns`);
console.log(
  `    matches "v1.0.0": ${p1.some((p) => p.test("v1.0.0"))} ${
    p1.some((p) => p.test("v1.0.0")) ? "✅" : "❌"
  }`,
);
console.log(
  `    matches "release-1.0.0": ${p1.some((p) => p.test("release-1.0.0"))} ${
    !p1.some((p) => p.test("release-1.0.0")) ? "✅" : "❌"
  }`,
);

// Test 2: With user patterns
const p2 = buildMatchPatterns("v{{ nextVersion }}", ["release-*"]);
console.log(`\n  With user patterns (2 unique): ${p2.length} patterns`);
console.log(
  `    matches "v1.0.0": ${p2.some((p) => p.test("v1.0.0"))} ${
    p2.some((p) => p.test("v1.0.0")) ? "✅" : "❌"
  }`,
);
console.log(
  `    matches "release-2.0.0": ${
    p2.some((p) => p.test("release-2.0.0"))
  } ${p2.some((p) => p.test("release-2.0.0")) ? "✅" : "❌"}`,
);

// Test 3: Deduplication — user provides same as auto-derived
const p3 = buildMatchPatterns("v{{ nextVersion }}", ["v*"]);
console.log(
  `\n  Dedup (user = auto-derived): ${p3.length} pattern(s) ${
    p3.length === 1 ? "✅" : "❌ expected 1"
  }`,
);

console.log("\n=== All tests complete ===");

/**
 * Test: format_proposal_body filter behavior
 *
 * Run AFTER Phase E is implemented:
 *   deno test docs/wip/improve-experimental-monorepo-support/tests/test-format-proposal-body.ts
 *
 * These tests call the actual registered filter via the Liquid engine.
 * They verify the external output shape only — not internal resolution logic.
 */

import { assertEquals } from "@std/assert";
import { Liquid } from "liquidjs";

// ─── Minimal test harness ───────────────────────────────────────────────────

const engine = new Liquid();

// Register the filter under test (same registration logic as transformers.ts)
engine.registerFilter(
  "format_proposal_body",
  (releases: unknown) => {
    if (!Array.isArray(releases)) throw new Error("releases must be an array");

    const entries = releases as Array<{
      title?: string;
      memberBlock?: string;
    }>;

    if (entries.length === 0) return "";

    if (entries.length === 1) {
      // Single-repo: no heading, just the memberBlock
      return entries[0].memberBlock ?? "";
    }

    // Monorepo: heading + memberBlock per entry
    return entries
      .map((r) => `## ${r.title ?? ""}\n\n${r.memberBlock ?? ""}`)
      .join("\n\n");
  },
);

// ─── Helpers ────────────────────────────────────────────────────────────────

function render(template: string, ctx: Record<string, unknown>): Promise<string> {
  return engine.parseAndRender(template, ctx);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

Deno.test("format_proposal_body — single entry: no heading, just memberBlock", async () => {
  const releases = [
    {
      name: "root",
      title: "root",
      tagName: "v1.2.3",
      memberBlock: "<!-- PROPOSAL-CHANGELOG-RELEASE-START:v1.2.3 -->\n## Fixes\n- fix: something\n<!-- PROPOSAL-CHANGELOG-RELEASE-END:v1.2.3 -->",
    },
  ];

  const result = await render("{{ releases | format_proposal_body }}", { releases });

  assertEquals(
    result,
    "<!-- PROPOSAL-CHANGELOG-RELEASE-START:v1.2.3 -->\n## Fixes\n- fix: something\n<!-- PROPOSAL-CHANGELOG-RELEASE-END:v1.2.3 -->",
  );
});

Deno.test("format_proposal_body — single entry: no heading even if title is set", async () => {
  const releases = [
    {
      name: "myapp",
      title: "My App",
      tagName: "myapp-v1.0.0",
      memberBlock: "<!-- PROPOSAL-CHANGELOG-RELEASE-START:myapp-v1.0.0 -->\nchangelog here\n<!-- PROPOSAL-CHANGELOG-RELEASE-END:myapp-v1.0.0 -->",
    },
  ];

  const result = await render("{{ releases | format_proposal_body }}", { releases });

  // Single entry → no ## heading
  assertEquals(result.includes("## My App"), false);
  assertEquals(result.includes("changelog here"), true);
});

Deno.test("format_proposal_body — multi entry: headings using title", async () => {
  const releases = [
    {
      name: "core",
      title: "Core Library",
      tagName: "core-v2.0.0",
      memberBlock: "<!-- PROPOSAL-CHANGELOG-RELEASE-START:core-v2.0.0 -->\ncore changes\n<!-- PROPOSAL-CHANGELOG-RELEASE-END:core-v2.0.0 -->",
    },
    {
      name: "utils",
      title: "Utils",
      tagName: "utils-v1.5.0",
      memberBlock: "<!-- PROPOSAL-CHANGELOG-RELEASE-START:utils-v1.5.0 -->\nutils changes\n<!-- PROPOSAL-CHANGELOG-RELEASE-END:utils-v1.5.0 -->",
    },
  ];

  const result = await render("{{ releases | format_proposal_body }}", { releases });

  assertEquals(result.includes("## Core Library"), true);
  assertEquals(result.includes("## Utils"), true);
  assertEquals(result.includes("core changes"), true);
  assertEquals(result.includes("utils changes"), true);
});

Deno.test("format_proposal_body — multi entry: title defaults to name when not set", async () => {
  const releases = [
    {
      name: "core",
      title: "core", // same as name (no custom title)
      tagName: "core-v2.0.0",
      memberBlock: "<!-- PROPOSAL-CHANGELOG-RELEASE-START:core-v2.0.0 -->\ncore changes\n<!-- PROPOSAL-CHANGELOG-RELEASE-END:core-v2.0.0 -->",
    },
    {
      name: "utils",
      title: "utils",
      tagName: "utils-v1.5.0",
      memberBlock: "<!-- PROPOSAL-CHANGELOG-RELEASE-START:utils-v1.5.0 -->\nutils changes\n<!-- PROPOSAL-CHANGELOG-RELEASE-END:utils-v1.5.0 -->",
    },
  ];

  const result = await render("{{ releases | format_proposal_body }}", { releases });

  assertEquals(result.includes("## core"), true);
  assertEquals(result.includes("## utils"), true);
});

Deno.test("format_proposal_body — multi entry: memberBlocks are ordered as given", async () => {
  const releases = [
    {
      name: "core",
      title: "Core",
      tagName: "core-v2.0.0",
      memberBlock: "CORE_BLOCK",
    },
    {
      name: "utils",
      title: "Utils",
      tagName: "utils-v1.5.0",
      memberBlock: "UTILS_BLOCK",
    },
  ];

  const result = await render("{{ releases | format_proposal_body }}", { releases });

  const coreIdx = result.indexOf("CORE_BLOCK");
  const utilsIdx = result.indexOf("UTILS_BLOCK");
  assertEquals(coreIdx < utilsIdx, true, "core block should appear before utils block");
});

Deno.test("format_proposal_body — empty releases: returns empty string", async () => {
  const result = await render("{{ releases | format_proposal_body }}", { releases: [] });
  assertEquals(result, "");
});

Deno.test("format_proposal_body — memberBlock with member header and footer present", async () => {
  // The memberBlock is assembled by application code and already contains header + markers + footer
  const memberHeader = "> Please review the API breaking changes carefully.";
  const memberBodyContent = "## Breaking Changes\n- removed `foo`";
  const markerStart = "<!-- PROPOSAL-CHANGELOG-RELEASE-START:api-v3.0.0 -->";
  const markerEnd = "<!-- PROPOSAL-CHANGELOG-RELEASE-END:api-v3.0.0 -->";
  const memberFooter = "> Thanks for reviewing!";

  const memberBlock = [memberHeader, markerStart, memberBodyContent, markerEnd, memberFooter]
    .filter(Boolean)
    .join("\n\n");

  const releases = [
    {
      name: "api",
      title: "API",
      tagName: "api-v3.0.0",
      memberBlock,
    },
    {
      name: "sdk",
      title: "SDK",
      tagName: "sdk-v1.0.0",
      memberBlock: "<!-- PROPOSAL-CHANGELOG-RELEASE-START:sdk-v1.0.0 -->\nSDK changes\n<!-- PROPOSAL-CHANGELOG-RELEASE-END:sdk-v1.0.0 -->",
    },
  ];

  const result = await render("{{ releases | format_proposal_body }}", { releases });

  assertEquals(result.includes(memberHeader), true);
  assertEquals(result.includes(memberFooter), true);
  assertEquals(result.includes(markerStart), true);
  assertEquals(result.includes(markerEnd), true);
  assertEquals(result.includes(memberBodyContent), true);
});

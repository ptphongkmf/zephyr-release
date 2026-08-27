import { toCamelCase, toKebabCase, toSnakeCase } from "@std/text";
import { dirname, join } from "@std/path";
import { toJsonSchema } from "@valibot/to-json-schema";
import traverse from "@json-schema-tools/traverse";
import { ConfigSchema } from "../src/schemas/configs/config.ts";
import { WorkspaceMemberConfigSchema } from "../src/schemas/configs/workspace-member-config.ts";
import { TimeZoneSchema } from "../src/schemas/configs/modules/components/timezone.ts";
import { DOCS_EXT_REF_TOKEN } from "../src/schemas/token.ts";

type GenJsonSchemaConfig = {
  outputFile: string;
  casingFn: (value: string) => string;
};

// Master config
const SCHEMA_VERSION = "v1";

const SCHEMA_CONFIG: GenJsonSchemaConfig[] = [
  {
    outputFile: "config-v1.kebab.json",
    casingFn: toKebabCase,
  },
  {
    outputFile: "config-v1.camel.json",
    casingFn: toCamelCase,
  },
  {
    outputFile: "config-v1.snake.json",
    casingFn: toSnakeCase,
  },
];

const WORKSPACE_SCHEMA_CONFIG: GenJsonSchemaConfig[] = [
  {
    outputFile: "workspace-config-v1.kebab.json",
    casingFn: toKebabCase,
  },
  {
    outputFile: "workspace-config-v1.camel.json",
    casingFn: toCamelCase,
  },
  {
    outputFile: "workspace-config-v1.snake.json",
    casingFn: toSnakeCase,
  },
];

const DOCS_REF_URL = "https://github.com/ptphongkmf/zephyr-release/blob/main";

// Base config json schema based on valibot schema
const baseSchema = toJsonSchema(ConfigSchema, {
  typeMode: "input",
  definitions: { timeZone: TimeZoneSchema },
  ignoreActions: ["trim", "safe_integer", "to_lower_case"],
});

// Workspace member config json schema
const baseWorkspaceSchema = toJsonSchema(WorkspaceMemberConfigSchema, {
  typeMode: "input",
  definitions: { timeZone: TimeZoneSchema },
  ignoreActions: ["trim", "safe_integer", "to_lower_case"],
});

function createTransformers(casingFn: GenJsonSchemaConfig["casingFn"]) {
  // Lookup table of properties we renamed (original → emitted name).
  // Needed to update `$ref`, `required`, and `description` references consistently.
  const schemaPropertyNameMap = new Map<string, string>();

  function transformKeys(
    schema: unknown,
    _isCycle: boolean,
    _path: string,
    _parent: unknown,
  ) {
    if (schema && typeof schema === "object") {
      // defs
      if (
        "$defs" in schema && schema.$defs && typeof schema.$defs === "object"
      ) {
        const defs = Object.fromEntries(
          Object.entries(schema.$defs).map(([k, v]) => [casingFn(k), v]),
        );

        schema.$defs = defs;
      }

      // refs
      if ("$ref" in schema && typeof schema.$ref === "string") {
        if (schema.$ref.startsWith("#")) {
          const parts = schema.$ref.split("/");
          const lastPart = parts.at(-1);

          if (lastPart) {
            parts[parts.length - 1] = casingFn(lastPart);

            schema.$ref = parts.join("/");
          }
        }
      }

      // properties
      if (
        "properties" in schema &&
        schema.properties &&
        typeof schema.properties === "object"
      ) {
        const props = Object.fromEntries(
          Object.entries(schema.properties).map(([k, v]) => {
            const casedKey = casingFn(k);
            schemaPropertyNameMap.set(k, casedKey);
            return [casedKey, v];
          }),
        );

        schema.properties = props;
      }

      // required
      if (
        "required" in schema &&
        Array.isArray(schema.required) &&
        schema.required.every((item) => typeof item === "string")
      ) {
        schema.required = schema.required.map((str) => casingFn(str));
      }
    }

    return schema;
  }

  function transformDescriptions(
    schema: unknown,
    _isCycle: boolean,
    _path: string,
    _parent: unknown,
  ) {
    if (schema && typeof schema === "object") {
      // description
      if ("description" in schema && typeof schema.description === "string") {
        schema.description = schema.description
          .replaceAll(DOCS_EXT_REF_TOKEN, DOCS_REF_URL)
          .replace(
            /`([^`]+)`/g,
            (_match, content: string) => {
              const transformedContent = content
                .split(".")
                .map((part) => schemaPropertyNameMap.get(part) ?? part)
                .join(".");

              return "`" + transformedContent + "`";
            },
          );
      }
    }

    return schema;
  }

  return { transformKeys, transformDescriptions };
}

function generateSchemas(
  sourceSchema: object,
  configs: GenJsonSchemaConfig[],
) {
  for (const { outputFile, casingFn } of configs) {
    // Work on a fresh copy for each variant so mutations don't interfere
    const schema = structuredClone(sourceSchema);
    const { transformKeys, transformDescriptions } = createTransformers(
      casingFn,
    );

    // Traverse and transform schema
    traverse.default(schema, transformKeys, { mutable: true });
    traverse.default(schema, transformDescriptions, { mutable: true });

    // Ensure output directory exists, then write schema file
    const outputPath = join(
      import.meta.dirname!,
      `../schemas/${SCHEMA_VERSION}/${outputFile}`,
    );

    Deno.mkdirSync(dirname(outputPath), { recursive: true });
    Deno.writeTextFileSync(
      outputPath,
      JSON.stringify(schema, null, 2),
    );
  }
}

// Generate root config schemas
generateSchemas(baseSchema, SCHEMA_CONFIG);

// Generate workspace member config schemas
generateSchemas(baseWorkspaceSchema, WORKSPACE_SCHEMA_CONFIG);

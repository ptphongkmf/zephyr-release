import { toCamelCase, toKebabCase, toSnakeCase } from "@std/text";
import { dirname, join } from "@std/path";
import { toJsonSchema } from "@valibot/to-json-schema";
import traverse, {
  type SyncMutationFunction,
} from "@json-schema-tools/traverse";
import {
  ConfigSchema,
  ROOT_VERSION_FILES_FORBIDDEN_MSG,
  ROOT_VERSION_FILES_REQUIRED_MSG,
} from "../src/schemas/configs/config.ts";
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

const DOCS_REF_URL = "https://github.com/ptphongkmf/zephyr-release/blob/main";

// Config JSON schema based on valibot schema
const configSchema = toJsonSchema(ConfigSchema, {
  typeMode: "input",
  definitions: { timeZone: TimeZoneSchema },
  ignoreActions: ["trim", "safe_integer", "to_lower_case"],
  overrideAction: (ctx) => {
    if (
      ctx.valibotAction.type === "partial_check" &&
      "message" in ctx.valibotAction
    ) {
      if (ctx.valibotAction.message === ROOT_VERSION_FILES_REQUIRED_MSG) {
        return {
          ...ctx.jsonSchema,
          if: { not: { required: ["workspace"] } },
          then: { required: ["versionFiles"] },
          else: { properties: { versionFiles: false } },
        };
      }

      if (ctx.valibotAction.message === ROOT_VERSION_FILES_FORBIDDEN_MSG) {
        return ctx.jsonSchema;
      }
    }
  },
});

function createTransformers(casingFn: GenJsonSchemaConfig["casingFn"]) {
  // Lookup table of properties we renamed (original → emitted name).
  // Needed to update `$ref`, `required`, and `description` references consistently.
  const schemaPropertyNameMap = new Map<string, string>();

  const transformKeys: SyncMutationFunction = (
    schema,
    _isCycle,
    _path,
    _parent,
  ) => {
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

      // conditional keywords skipped by @json-schema-tools/traverse
      for (const keyword of ["if", "then", "else", "not"] as const) {
        const sub = schema[keyword];
        if (sub && typeof sub === "object") {
          traverse.default(sub, transformKeys, { mutable: true });
        }
      }
    }

    return schema;
  };

  const transformDescriptions: SyncMutationFunction = (
    schema,
    _isCycle,
    _path,
    _parent,
  ) => {
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
  };

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

// Generate config schemas
generateSchemas(configSchema, SCHEMA_CONFIG);

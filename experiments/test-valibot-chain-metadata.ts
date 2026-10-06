import * as v from "@valibot/valibot";
import { toJsonSchema } from "@valibot/to-json-schema";

// The user asked to chain up to 5 levels using v.metadata
try {
  // level 1
  const schema1 = v.pipe(
    v.string(),
    v.email(),
    // @ts-ignore
    v.metadata ? v.metadata({ description: 'Level 1 description', unique: 'unique_1' }) : v.description('Level 1 description')
  );

  // level 2
  const schema2 = v.pipe(
    schema1,
    v.minLength(5),
    // @ts-ignore
    v.metadata ? v.metadata({ description: 'Level 2 description', unique: 'unique_2' }) : v.description('Level 2 description')
  );

  // level 3
  const schema3 = v.pipe(
    schema2,
    v.maxLength(100),
    // @ts-ignore
    v.metadata ? v.metadata({ description: 'Level 3 description', unique: 'unique_3' }) : v.description('Level 3 description')
  );

  // level 4
  const schema4 = v.pipe(
    schema3,
    // @ts-ignore
    v.metadata ? v.metadata({ description: 'Level 4 description', unique: 'unique_4' }) : v.description('Level 4 description')
  );

  // level 5
  const schema5 = v.pipe(
    schema4,
    // @ts-ignore
    v.metadata ? v.metadata({ description: 'Level 5 description', unique: 'unique_5' }) : v.description('Level 5 description')
  );

  console.log("=== Valibot getMetadata ===");
  if ('getMetadata' in v) {
    // @ts-ignore
    console.log(v.getMetadata(schema5));
  } else {
    console.log("No v.getMetadata, inspecting schema properties manually:");
    // In valibot v1, pipe actions are stored in schema5.item or similar, wait, pipe is a schema that has `item` (the base schema) and `pipe` (the array of actions).
    // Let's just log it deeply
    console.dir(schema5, { depth: null });
  }

  console.log("\n=== to-json-schema ===");
  const jsonSchema = toJsonSchema(schema5);
  console.dir(jsonSchema, { depth: null });

} catch (error) {
  console.error("Error creating or parsing schema:", error);
}

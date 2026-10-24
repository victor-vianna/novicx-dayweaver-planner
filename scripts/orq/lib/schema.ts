// Minimal JSON Schema check for the subset used by review-schema.json and
// task-schema.json: type, required, properties, additionalProperties: false,
// enum, items. Returns human-readable errors (empty = valid).

export interface JsonSchema {
  type?: "object" | "array" | "string" | "integer" | "number" | "boolean";
  required?: string[];
  properties?: Record<string, JsonSchema>;
  additionalProperties?: boolean;
  enum?: unknown[];
  items?: JsonSchema;
}

export function validateSchema(value: unknown, schema: JsonSchema, at = "$"): string[] {
  const errors: string[] = [];
  const t = schema.type;
  if (t === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return [`${at}: expected object`];
    }
    const obj = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in obj)) errors.push(`${at}.${key}: required`);
    }
    for (const [key, v] of Object.entries(obj)) {
      const sub = schema.properties?.[key];
      if (sub) errors.push(...validateSchema(v, sub, `${at}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${at}.${key}: not allowed`);
    }
  } else if (t === "array") {
    if (!Array.isArray(value)) return [`${at}: expected array`];
    if (schema.items) {
      value.forEach((v, i) => errors.push(...validateSchema(v, schema.items!, `${at}[${i}]`)));
    }
  } else if (t === "string" && typeof value !== "string") {
    return [`${at}: expected string`];
  } else if (t === "integer" && !Number.isInteger(value)) {
    return [`${at}: expected integer`];
  } else if (t === "number" && typeof value !== "number") {
    return [`${at}: expected number`];
  } else if (t === "boolean" && typeof value !== "boolean") {
    return [`${at}: expected boolean`];
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${at}: ${JSON.stringify(value)} not in ${JSON.stringify(schema.enum)}`);
  }
  return errors;
}

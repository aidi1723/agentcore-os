import type { ControlledPlaybookSchema } from "@/lib/executor/playbooks/types";

export type ControlledOutputValidationResult = {
  valid: boolean;
  errors: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function typeName(value: unknown) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function validateField(name: string, value: unknown, schema: Record<string, unknown>) {
  const errors: string[] = [];
  if (Array.isArray(schema.enum)) {
    if (!schema.enum.includes(value)) {
      errors.push(`Field ${name} must be one of ${schema.enum.join(", ")}`);
    }
    return errors;
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      errors.push(`Field ${name} must be array`);
      return errors;
    }
    const itemSchema = isRecord(schema.items) ? schema.items : null;
    if (itemSchema?.type) {
      value.forEach((item, index) => {
        if (typeName(item) !== itemSchema.type) {
          errors.push(`Field ${name}[${index}] must be ${itemSchema.type}`);
        }
      });
    }
    return errors;
  }

  if (schema.type && typeName(value) !== schema.type) {
    errors.push(`Field ${name} must be ${schema.type}`);
  }
  return errors;
}

export function validateControlledOutput(
  output: unknown,
  schema: ControlledPlaybookSchema,
): ControlledOutputValidationResult {
  const errors: string[] = [];
  if (!isRecord(output)) {
    return { valid: false, errors: ["Output must be an object"] };
  }

  for (const field of schema.required ?? []) {
    if (!(field in output)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  const properties = schema.properties ?? {};
  for (const [field, value] of Object.entries(output)) {
    const fieldSchema = properties[field];
    if (!fieldSchema) {
      if (schema.additionalProperties === false) {
        errors.push(`Unexpected field: ${field}`);
      }
      continue;
    }
    if (fieldSchema && typeof fieldSchema === "object") {
      errors.push(...validateField(field, value, fieldSchema as Record<string, unknown>));
    }
  }

  return { valid: errors.length === 0, errors };
}

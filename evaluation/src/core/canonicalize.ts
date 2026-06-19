import canonicalize from 'canonicalize';

/**
 * Returns a canonical JSON representation of the value according to RFC 8785.
 * This ensures that identical objects stringify to the exact same string,
 * ignoring property definition order.
 */
export function canonicalizeJson(value: unknown): string {
  const result = canonicalize(value);
  if (result === undefined) {
    throw new Error('Value cannot be canonicalized (e.g. contains undefined values at top level or functions)');
  }
  return result;
}

/**
 * Returns true if objects `a` and `b` are semantically equal.
 * This is meant for checking alias equality where no fields should be ignored.
 */
export function semanticEqualForAlias(a: unknown, b: unknown): boolean {
  return canonicalizeJson(a) === canonicalizeJson(b);
}

/**
 * Strips explicitly allowed volatile fields from an object.
 */
function stripAllowedFields(obj: unknown, allowedFields: string[]): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => stripAllowedFields(item, allowedFields));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (!allowedFields.includes(key)) {
      result[key] = stripAllowedFields(val, allowedFields);
    }
  }
  return result;
}

const ALLOWED_VOLATILE_FIELDS = [
  'runId',
  'generatedAt',
  'latestGeneratedAt',
  'lastAttemptedRunId'
];

/**
 * Returns true if objects `a` and `b` are reproducible across runs.
 * Only explicit volatile fields like 'runId' and 'generatedAt' can be ignored.
 */
export function reproducibleAcrossRuns(
  a: unknown,
  b: unknown,
  ignoreFields: string[] = ALLOWED_VOLATILE_FIELDS
): boolean {
  // Enforce the explicit allowlist rule
  for (const field of ignoreFields) {
    if (!ALLOWED_VOLATILE_FIELDS.includes(field)) {
      throw new Error(`Field '${field}' is not in the explicit allowlist for volatile fields and cannot be ignored.`);
    }
  }

  const objA = stripAllowedFields(structuredClone(a), ignoreFields);
  const objB = stripAllowedFields(structuredClone(b), ignoreFields);

  return canonicalizeJson(objA) === canonicalizeJson(objB);
}

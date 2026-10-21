import { z } from 'zod';

// Existing transport acknowledgements; these do not imply finalization or job completion.
export const okResponseSchema = z.object({ ok: z.literal(true) });
export const successResponseSchema = z.object({ success: z.literal(true) });
export const memberRemovalResponseSchema = z.object({ removed: z.literal(true) });

export const applicationErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export const httpErrorResponseSchema = z.object({
  statusCode: z.number().int(),
  message: z.union([z.string(), z.array(z.unknown())]),
  error: z.string().optional(),
});

export const apiErrorResponseSchema = z.union([
  applicationErrorResponseSchema,
  httpErrorResponseSchema,
  z.object({ message: z.string(), errorCode: z.string().nullable() }),
]);

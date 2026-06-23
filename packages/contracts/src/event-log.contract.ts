import { z } from 'zod';

export const eventLogDtoSchema = z.object({
  id: z.string(),
  eventType: z.string(),
  idempotencyKey: z.string(),
  actorType: z.enum(['SYSTEM', 'USER']).catch('SYSTEM'),
  actorName: z.string().nullable().optional(),
  triggeredByUserId: z.string().nullable().optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  createdAt: z.string(),
});

export type EventLogDto = z.infer<typeof eventLogDtoSchema>;

export const eventLogListResponseSchema = z.object({
  items: z.array(eventLogDtoSchema),
});

export type EventLogListResponse = z.infer<typeof eventLogListResponseSchema>;

import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

export type EventLogTransactionClient = Pick<Prisma.TransactionClient, 'domainEvent'>;

export class EventLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createEvent(params: {
    eventType: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
  }, transaction?: EventLogTransactionClient): Promise<void> {
    const client = transaction ?? this.prisma;
    await client.domainEvent.createMany({
      data: {
        eventType: params.eventType,
        idempotencyKey: params.idempotencyKey,
        payload: params.payload as Prisma.InputJsonValue,
      },
      skipDuplicates: true,
    });
  }

  async findEventsByPrefixes(prefixes: string[]): Promise<any[]> {
    if (prefixes.length === 0) return [];

    return this.prisma.domainEvent.findMany({
      where: {
        OR: prefixes.map(prefix => ({
          idempotencyKey: { startsWith: prefix }
        }))
      },
      orderBy: [
        { createdAt: 'asc' },
        { id: 'asc' }
      ]
    });
  }
}

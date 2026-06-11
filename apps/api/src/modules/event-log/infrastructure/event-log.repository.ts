import { PrismaService } from '../../prisma/prisma.service';

export class EventLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createEvent(params: {
    eventType: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.domainEvent.upsert({
      where: {
        idempotencyKey: params.idempotencyKey,
      },
      create: {
        eventType: params.eventType,
        idempotencyKey: params.idempotencyKey,
        payload: params.payload as import('@prisma/client').Prisma.InputJsonValue,
      },
      update: {},
    });
  }
}

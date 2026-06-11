"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventLogRepository = void 0;
class EventLogRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createEvent(params) {
        await this.prisma.domainEvent.create({
            data: {
                eventType: params.eventType,
                idempotencyKey: params.idempotencyKey,
                payload: params.payload,
            },
        });
    }
}
exports.EventLogRepository = EventLogRepository;

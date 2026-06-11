"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventLogService = void 0;
class EventLogService {
    constructor(repository) {
        this.repository = repository;
    }
    async recordEvent(params) {
        await this.repository.createEvent(params);
    }
}
exports.EventLogService = EventLogService;

import { Injectable, Logger } from '@nestjs/common';

/**
 * Generic activity audit log. It records many kinds of activity (including the
 * word "register") but is NOT a primary impact of onboarding change requests —
 * it is keyword noise for the retrieval/adjudication net.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly entries: Array<{ action: string; subjectId: string; at: Date }> = [];

  recordActivity(action: string, subjectId: string): void {
    this.entries.push({ action, subjectId, at: new Date() });
    this.logger.debug(`Recorded activity ${action} for ${subjectId}`);
  }
}

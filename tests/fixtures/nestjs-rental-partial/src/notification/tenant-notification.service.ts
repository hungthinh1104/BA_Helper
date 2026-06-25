import { Injectable } from '@nestjs/common';

@Injectable()
export class TenantNotificationService {
  async notifyTenantAndLandlord(
    tenantId: string,
    landlordId: string,
    contractId: string,
  ): Promise<void> {
    return;
  }
}

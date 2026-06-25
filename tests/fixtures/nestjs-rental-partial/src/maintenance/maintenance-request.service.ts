import { Injectable } from '@nestjs/common';

@Injectable()
export class MaintenanceRequestService {
  async openMaintenanceRequest(roomId: string): Promise<void> {
    return;
  }
}

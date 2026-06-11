import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationService {
  async notifyOwner(ownerId: string, bookingId: string): Promise<void> {
    return;
  }
}

import { Injectable } from '@nestjs/common';

@Injectable()
export class RoomAvailabilityService {
  async updateAvailability(roomId: string, isAvailable: boolean): Promise<void> {
    return;
  }
}

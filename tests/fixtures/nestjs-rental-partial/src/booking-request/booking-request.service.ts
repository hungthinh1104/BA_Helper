import { Injectable } from '@nestjs/common';
import { RoomAvailabilityService } from '../room/room-availability.service';

@Injectable()
export class BookingRequestService {
  constructor(private readonly roomAvailabilityService: RoomAvailabilityService) {}

  async markRoomUnavailableForRequest(requestId: string, roomId: string): Promise<void> {
    await this.roomAvailabilityService.updateAvailability(roomId, false);
    return;
  }
}

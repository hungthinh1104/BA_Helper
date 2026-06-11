import { Controller, Post, Param } from '@nestjs/common';
import { BookingService } from './booking.service';

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post(':id/cancel')
  async cancel(@Param('id') id: string) {
    return this.bookingService.cancelBooking(id);
  }
}

import { Injectable } from '@nestjs/common';
import { PaymentService } from '../payment/payment.service';
import { SlotService } from '../slot/slot.service';
import { NotificationService } from '../notification/notification.service';
import { Booking, BookingStatus } from './booking.entity';

@Injectable()
export class BookingService {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly slotService: SlotService,
    private readonly notificationService: NotificationService,
  ) {}

  async cancelBooking(bookingId: string): Promise<Booking> {
    const booking = new Booking(bookingId, BookingStatus.PAID);
    booking.status = BookingStatus.CANCELLED;

    await this.paymentService.refund(bookingId);
    await this.slotService.releaseSlot(booking.slotId);
    await this.notificationService.notifyOwner(booking.ownerId, bookingId);

    return booking;
  }
}

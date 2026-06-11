import { BookingService } from './booking.service';
import { BookingStatus } from './booking.entity';

describe('BookingService.cancelBooking', () => {
  it('sets status to CANCELLED', async () => {
    const service = new BookingService(
      { refund: async () => undefined } as any,
      { releaseSlot: async () => undefined } as any,
      { notifyOwner: async () => undefined } as any,
    );

    const booking = await service.cancelBooking('b1');
    expect(booking.status).toBe(BookingStatus.CANCELLED);
  });
});

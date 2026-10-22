import { afterEach, beforeEach as setup, expect, it, jest } from '@jest/globals';
import { BookingService } from '../src/booking/booking.service';

describe('paid booking refund', () => {
  setup(() => {
    const paidBooking = { bookingId: 'booking-104', status: 'PAID' };
    bookingRepository.insert(paidBooking);
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('cancels a paid booking and requests a refund', async () => {
    const request = { bookingId: 'booking-104', reason: 'guest-request' };
    const refund = jest.fn().mockResolvedValue({ status: 'REFUNDED' });
    const service = new BookingService(refund);

    const result = await service.cancelPaidBooking(request);

    expect(refund).toHaveBeenCalledWith(request);
    expect(result.status).toBe('REFUNDED');
  });
});

import { Injectable } from '@nestjs/common';

@Injectable()
export class BookingService {
  constructor(private readonly refund: { (request: unknown): Promise<{ status: string }> }) {}

  async cancelPaidBooking(request: { bookingId: string; reason: string }): Promise<{ status: string }> {
    await this.refund(request);
    return { status: 'REFUNDED' };
  }
}

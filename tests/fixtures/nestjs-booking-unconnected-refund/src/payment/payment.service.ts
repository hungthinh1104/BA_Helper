import { Injectable } from '@nestjs/common';
import { PaymentTransaction, PaymentStatus } from './payment.entity';

@Injectable()
export class PaymentService {
  async refund(bookingId: string): Promise<PaymentTransaction> {
    const transaction = new PaymentTransaction(bookingId, PaymentStatus.PAID);
    transaction.status = PaymentStatus.REFUNDED;
    return transaction;
  }
}

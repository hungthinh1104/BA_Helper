import { Inject, Injectable } from '@nestjs/common';

export type RefundRequest = {
  id: string;
  paymentId: string;
  status: string;
};

export type RefundResult = { status: 'REFUNDED' | 'FAILED' };

export interface RefundGateway {
  refund(paymentId: string): Promise<RefundResult>;
}

@Injectable()
export class RefundService {
  constructor(@Inject('RefundGateway') private readonly gateway: RefundGateway) {}

  async cancelAndRefund(request: RefundRequest): Promise<RefundResult> {
    if (request.status !== 'PAID') throw new Error('Only paid bookings can be refunded.');
    return this.gateway.refund(request.paymentId);
  }
}

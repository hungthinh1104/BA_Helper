export enum PaymentStatus {
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
}

export class PaymentTransaction {
  constructor(
    public readonly bookingId: string,
    public status: PaymentStatus,
  ) {}
}

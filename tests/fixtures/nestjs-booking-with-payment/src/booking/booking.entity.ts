export enum BookingStatus {
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export class Booking {
  constructor(
    public readonly id: string,
    public status: BookingStatus,
  ) {}

  get slotId(): string {
    return `slot-${this.id}`;
  }

  get ownerId(): string {
    return `owner-${this.id}`;
  }
}

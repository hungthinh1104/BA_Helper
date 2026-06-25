export enum ContractStatus {
  DRAFT = 'DRAFT',
  DEPOSIT_PAID = 'DEPOSIT_PAID',
  CANCELLED = 'CANCELLED',
}

export class RentalContract {
  constructor(
    public readonly id: string,
    public status: ContractStatus,
  ) {}

  get tenantId(): string {
    return `tenant-${this.id}`;
  }

  get landlordId(): string {
    return `landlord-${this.id}`;
  }
}

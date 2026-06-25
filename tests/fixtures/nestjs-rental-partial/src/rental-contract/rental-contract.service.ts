import { Injectable } from '@nestjs/common';
import { PaymentRecordService } from '../payment/payment-record.service';
import { TenantNotificationService } from '../notification/tenant-notification.service';
import { ContractStatus, RentalContract } from './rental-contract.entity';

@Injectable()
export class RentalContractService {
  constructor(
    private readonly paymentRecordService: PaymentRecordService,
    private readonly tenantNotificationService: TenantNotificationService,
  ) {}

  async updateDepositPayment(contractId: string): Promise<RentalContract> {
    const contract = new RentalContract(contractId, ContractStatus.DRAFT);
    await this.paymentRecordService.recordDeposit(contractId);
    contract.status = ContractStatus.DEPOSIT_PAID;
    return contract;
  }

  async cancelContract(contractId: string): Promise<RentalContract> {
    const contract = new RentalContract(contractId, ContractStatus.DEPOSIT_PAID);
    contract.status = ContractStatus.CANCELLED;
    await this.paymentRecordService.markContractCancelled(contractId);
    await this.tenantNotificationService.notifyTenantAndLandlord(
      contract.tenantId,
      contract.landlordId,
      contractId,
    );
    return contract;
  }
}

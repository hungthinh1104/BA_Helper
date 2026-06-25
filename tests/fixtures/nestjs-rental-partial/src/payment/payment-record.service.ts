import { Injectable } from '@nestjs/common';

export type PaymentRecord = {
  contractId: string;
  kind: 'DEPOSIT' | 'CONTRACT_CANCELLED';
};

@Injectable()
export class PaymentRecordService {
  async recordDeposit(contractId: string): Promise<PaymentRecord> {
    return { contractId, kind: 'DEPOSIT' };
  }

  async markContractCancelled(contractId: string): Promise<PaymentRecord> {
    return { contractId, kind: 'CONTRACT_CANCELLED' };
  }
}

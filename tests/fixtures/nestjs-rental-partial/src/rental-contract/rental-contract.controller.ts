import { Controller, Param, Post } from '@nestjs/common';
import { RentalContractService } from './rental-contract.service';

@Controller('rental-contracts')
export class RentalContractController {
  constructor(private readonly rentalContractService: RentalContractService) {}

  @Post(':id/deposit')
  async updateDeposit(@Param('id') id: string) {
    return this.rentalContractService.updateDepositPayment(id);
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string) {
    return this.rentalContractService.cancelContract(id);
  }
}

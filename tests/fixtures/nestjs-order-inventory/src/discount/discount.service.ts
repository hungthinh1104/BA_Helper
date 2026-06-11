import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class DiscountService {
  private readonly logger = new Logger(DiscountService.name);

  applyDiscountToOrder(orderId: string, discountCode: string) {
    this.logger.log(`Applying discount ${discountCode} to order ${orderId}`);
    // mock logic
    return true;
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async checkAvailability(productId: string, quantity: number): Promise<boolean> {
    const product = await this.productRepo.findOne({ where: { id: productId } });
    return product ? product.availableStock >= quantity : false;
  }
}

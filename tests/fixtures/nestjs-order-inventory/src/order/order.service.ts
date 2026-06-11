import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './order.entity';
import { OrderStatus } from './order-status.enum';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly inventoryService: InventoryService,
  ) {}

  async cancelOrder(orderId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.status === OrderStatus.SHIPPED || order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('Cannot cancel an order that has already been shipped or delivered');
    }

    if (order.status === OrderStatus.CANCELLED) {
      return order; // idempotent
    }

    // Release inventory reservation
    await this.inventoryService.releaseReservation(orderId);

    // Update order status
    order.status = OrderStatus.CANCELLED;
    return this.orderRepo.save(order);
  }

  async shipOrder(orderId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order || order.status !== OrderStatus.PAYMENT_CONFIRMED) {
      throw new BadRequestException('Order not ready for shipment');
    }

    await this.inventoryService.consumeReservation(orderId);
    order.status = OrderStatus.SHIPPED;
    return this.orderRepo.save(order);
  }
}

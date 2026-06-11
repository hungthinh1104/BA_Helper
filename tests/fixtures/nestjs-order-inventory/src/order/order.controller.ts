import { Controller, Post, Param, HttpCode } from '@nestjs/common';
import { OrderService } from './order.service';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post(':id/cancel')
  @HttpCode(200)
  async cancelOrder(@Param('id') id: string) {
    const order = await this.orderService.cancelOrder(id);
    return { success: true, orderId: order.id, status: order.status };
  }

  @Post(':id/ship')
  @HttpCode(200)
  async shipOrder(@Param('id') id: string) {
    const order = await this.orderService.shipOrder(id);
    return { success: true, orderId: order.id, status: order.status };
  }
}

import { OrderService } from './order.service';
import { OrderStatus } from './order-status.enum';

describe('OrderService - cancelOrder', () => {
  it('should cancel the order and release inventory if order is not shipped', async () => {
    // mock setup...
  });

  it('should throw an error if the order is already shipped', async () => {
    // mock setup...
  });

  it('should be idempotent if order is already cancelled', async () => {
    // mock setup...
  });
});

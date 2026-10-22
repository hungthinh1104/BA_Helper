import { Test, TestingModule } from '@nestjs/testing';
import { RefundService } from '../src/refund.service';

const gateway = { refund: jest.fn() };

describe('RefundService', () => {
  let service: RefundService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RefundService, { provide: 'RefundGateway', useValue: gateway }],
    }).compile();
    service = module.get(RefundService);
    gateway.refund.mockResolvedValue({ status: 'REFUNDED' });
  });

  it('refunds a paid booking', async () => {
    const booking = { id: 'booking-42', paymentId: 'payment-42', status: 'PAID' };
    const result = await service.cancelAndRefund(booking);
    expect(gateway.refund).toHaveBeenCalledWith(booking.paymentId);
    expect(result.status).toBe('REFUNDED');
  });

  it('diagnoses unsupported assertions and nested callbacks', async () => {
    const booking = { id: 'booking-43', paymentId: 'payment-43', status: 'PAID' };
    const result = await service.cancelAndRefund(booking);
    setTimeout(() => service.cancelAndRefund(booking), 0);
    expect(result)[dynamicMatcher]('REFUNDED');
    expect(result).toMatchSnapshot();
  });
});

const dynamicMatcher = 'toBe';

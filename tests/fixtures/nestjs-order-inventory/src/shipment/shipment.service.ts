import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shipment } from './shipment.entity';

@Injectable()
export class ShipmentService {
  private readonly logger = new Logger(ShipmentService.name);

  constructor(
    @InjectRepository(Shipment)
    private readonly shipmentRepo: Repository<Shipment>,
  ) {}

  async createShipment(orderId: string, carrier: string): Promise<Shipment> {
    this.logger.log(`Creating shipment for order ${orderId} via ${carrier}`);
    const shipment = this.shipmentRepo.create({
      orderId,
      carrier,
      trackingNumber: `TRK-${Date.now()}`,
      status: 'PENDING'
    });
    return this.shipmentRepo.save(shipment);
  }
}

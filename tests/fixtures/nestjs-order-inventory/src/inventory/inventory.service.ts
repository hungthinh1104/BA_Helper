import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockReservation, ReservationStatus } from './stock-reservation.entity';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(StockReservation)
    private readonly reservationRepo: Repository<StockReservation>,
  ) {}

  async reserveStock(orderId: string, productId: string, quantity: number): Promise<StockReservation> {
    const reservation = this.reservationRepo.create({
      orderId,
      productId,
      quantity,
      status: ReservationStatus.ACTIVE
    });
    return this.reservationRepo.save(reservation);
  }

  async releaseReservation(orderId: string): Promise<void> {
    const reservations = await this.reservationRepo.find({
      where: { orderId, status: ReservationStatus.ACTIVE }
    });

    if (!reservations.length) {
      this.logger.warn(`No active reservations found for order ${orderId}`);
      return;
    }

    for (const res of reservations) {
      res.status = ReservationStatus.RELEASED;
    }
    
    await this.reservationRepo.save(reservations);
    this.logger.log(`Released ${reservations.length} reservations for order ${orderId}`);
  }

  async consumeReservation(orderId: string): Promise<void> {
    const reservations = await this.reservationRepo.find({
      where: { orderId, status: ReservationStatus.ACTIVE }
    });

    for (const res of reservations) {
      res.status = ReservationStatus.CONSUMED;
    }
    await this.reservationRepo.save(reservations);
  }
}

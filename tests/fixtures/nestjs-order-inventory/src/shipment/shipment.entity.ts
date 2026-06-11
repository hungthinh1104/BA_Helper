import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Shipment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @Column()
  trackingNumber: string;

  @Column()
  carrier: string;

  @Column()
  status: string;
}

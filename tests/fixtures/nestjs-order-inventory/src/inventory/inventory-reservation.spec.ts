import { InventoryService } from './inventory.service';
import { ReservationStatus } from './stock-reservation.entity';

describe('InventoryService', () => {
  describe('releaseReservation', () => {
    it('should set status of all active reservations for the order to RELEASED', async () => {
      // mock setup...
    });

    it('should ignore already released reservations', async () => {
      // mock setup...
    });
  });
});

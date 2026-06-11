import { Injectable } from '@nestjs/common';

@Injectable()
export class AdminRefundReportService {
  generateReport() {
    return 'refund report ready';
  }
}

import { Controller, Get } from '@nestjs/common';
import { systemHealthResponseSchema } from '@ba-helper/contracts';
import { GetSystemHealthUseCase } from '../application/get-system-health.usecase';
import { Public } from '../../auth/application/jwt-auth.guard';

@Controller('/api/v1/system')
@Public()
export class SystemController {
  constructor(private readonly getSystemHealth: GetSystemHealthUseCase) {}

  @Get('/health')
  async getHealth() {
    return systemHealthResponseSchema.parse(
      await this.getSystemHealth.execute(),
    );
  }
}


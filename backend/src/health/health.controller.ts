import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly svc: HealthService) {}

  @Get('/health')
  health() {
    return this.svc.health();
  }

  @Get('/api/v1/version')
  version() {
    return { version: '0.1.0' };
  }
}

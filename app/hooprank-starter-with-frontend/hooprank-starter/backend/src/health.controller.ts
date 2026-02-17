/**
 * Health Controller — Single-purpose health check endpoint.
 *
 * All other methods have been extracted to focused controllers:
 *   - SeedingController (src/admin/seeding.controller.ts) — seed/* routes
 *   - DebugController (src/admin/debug.controller.ts) — debug/* routes
 *   - AdminController (src/admin/admin.controller.ts) — migrate/* and cleanup/* routes
 */
import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './auth/public.decorator';

@SkipThrottle()
@Controller()
export class HealthController {
    @Get('health')
    @Public()
    getHealth() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
        };
    }
}

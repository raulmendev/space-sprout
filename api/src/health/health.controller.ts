import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  /** Liveness: the process is up. Never touches the database, so polling it lets Neon scale to zero. */
  @Get()
  live() {
    return { status: 'ok' };
  }

  /** Readiness: 200 when the database answers, 503 otherwise. Wakes Neon; don't poll it. */
  @Get('db')
  @HealthCheck()
  ready() {
    return this.health.check([() => this.db.pingCheck('database', { timeout: 5000 })]);
  }
}

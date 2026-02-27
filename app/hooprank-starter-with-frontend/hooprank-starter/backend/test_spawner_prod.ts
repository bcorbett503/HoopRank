import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { RunsService } from './src/runs/runs.service';

async function bootstrap() {
  process.env.DATABASE_URL = 'postgresql://postgres:wXz9rB5vQ8p2L6nK4m7J1gH3sD0fA2e9@roundhouse.proxy.rlwy.net:45952/railway?sslmode=disable';
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const runsService = app.get(RunsService);
  console.log("Forcing execution of spawnUpcomingRecurringRuns()...");
  await runsService.spawnUpcomingRecurringRuns();
  console.log("Done.");

  await app.close();
}
bootstrap();

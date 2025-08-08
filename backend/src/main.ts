import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0'); // <-- important for ECS/ALB
}
bootstrap();

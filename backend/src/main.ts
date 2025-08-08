import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0'; // <- important on ECS

  await app.listen(port, host);
  // optional: quick startup log
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://${host}:${port}`);
}
bootstrap();

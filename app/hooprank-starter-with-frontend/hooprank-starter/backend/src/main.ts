import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';
import { DataSource } from 'typeorm';
import { runSchemaEvolution } from './common/schema-evolution';
import { HttpExceptionFilter } from './common/http-exception.filter';

// Run necessary database migrations at startup
async function runStartupMigrations(dataSource: DataSource): Promise<void> {
  console.log('Running startup migrations...');
  await runSchemaEvolution(dataSource);
  console.log('Startup migrations complete.');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Run startup migrations
  const dataSource = app.get(DataSource);
  await runStartupMigrations(dataSource);

  // Register global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Enable DTO validation globally — strips unknown fields, transforms types
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,        // strip properties not in the DTO
    transform: true,        // auto-cast query params to declared types
    forbidNonWhitelisted: false, // don't throw on extra fields, just strip them
  }));

  // Increase JSON body size limit for base64 image uploads
  app.use(bodyParser.json({ limit: '5mb' }));
  app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));

  app.enableCors({
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:8080'],
    credentials: true,
  });
  const config = new DocumentBuilder()
    .setTitle('HoopRank API')
    .setDescription('MVP endpoints for HoopRank (matches, users, ratings)')
    .setVersion('0.1.1')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`HoopRank API running on http://localhost:${port}`);
}
bootstrap();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // allow web app to call API from localhost origins
  const config = new DocumentBuilder()
    .setTitle('HoopRank API')
    .setDescription('MVP endpoints for HoopRank (matches, users, ratings)')
    .setVersion('0.1.1')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`HoopRank API running on http://localhost:${port}`);
}
bootstrap();

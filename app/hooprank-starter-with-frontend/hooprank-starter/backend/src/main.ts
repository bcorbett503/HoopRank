import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Increase JSON body size limit for base64 image uploads
  app.use(bodyParser.json({ limit: '5mb' }));
  app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));

  app.enableCors(); // allow web app to call API from localhost origins
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

// Force rebuild Wed Jan 28 12:12:43 PST 2026
// Trigger redeploy Thu Jan 29 08:54:38 PST 2026

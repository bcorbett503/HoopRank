import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';
import { DataSource } from 'typeorm';

// Run necessary database migrations at startup
async function runStartupMigrations(dataSource: DataSource): Promise<void> {
  console.log('Running startup migrations...');

  try {
    // Check and fix user_id column types for engagement tables
    // These were originally created as INTEGER but need to be VARCHAR for Firebase UIDs
    const tablesToFix = ['status_likes', 'status_comments', 'event_attendees'];

    for (const table of tablesToFix) {
      try {
        // Check if table exists
        const tableExists = await dataSource.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = $1
          )
        `, [table]);

        if (!tableExists[0]?.exists) {
          console.log(`  Table ${table} does not exist, skipping...`);
          continue;
        }

        // Check current column type
        const columnInfo = await dataSource.query(`
          SELECT data_type FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'user_id'
        `, [table]);

        if (columnInfo.length === 0) {
          console.log(`  Table ${table} has no user_id column, skipping...`);
          continue;
        }

        const currentType = columnInfo[0]?.data_type;

        if (currentType === 'integer') {
          console.log(`  Fixing ${table}.user_id: integer -> varchar...`);

          // Drop FK constraint if exists
          await dataSource.query(`
            ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_user_id_fkey
          `);

          // Change column type
          await dataSource.query(`
            ALTER TABLE ${table} 
            ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::VARCHAR(255)
          `);

          console.log(`  ✓ Fixed ${table}.user_id`);
        } else {
          console.log(`  ${table}.user_id already varchar, skipping...`);
        }

        // Also fix status_id foreign key to point to player_statuses
        // The original migration may have created FK pointing to wrong table
        console.log(`  Checking ${table}.status_id FK constraint...`);

        try {
          // Drop old FK constraint if exists (might reference wrong table)
          await dataSource.query(`
            ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_status_id_fkey
          `);

          // Re-create with correct reference to player_statuses
          await dataSource.query(`
            ALTER TABLE ${table} 
            ADD CONSTRAINT ${table}_status_id_fkey 
            FOREIGN KEY (status_id) 
            REFERENCES player_statuses(id) 
            ON DELETE CASCADE
          `);

          console.log(`  ✓ Verified ${table}.status_id FK`);
        } catch (fkError) {
          // Constraint might already exist with correct reference
          console.log(`  FK constraint already correct or error: ${fkError.message}`);
        }
      } catch (tableError) {
        console.error(`  Error fixing ${table}:`, tableError.message);
      }
    }

    console.log('Startup migrations complete.');
  } catch (error) {
    console.error('Startup migration error:', error.message);
    // Don't throw - allow app to continue starting
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Run startup migrations
  const dataSource = app.get(DataSource);
  await runStartupMigrations(dataSource);

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


// Force rebuild Wed Jan 29 12:20:00 PST 2026


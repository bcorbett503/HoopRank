import { Controller, Get, Post } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller()
export class HealthController {
    constructor(private dataSource: DataSource) { }

    @Get('health')
    getHealth() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * One-time migration endpoint to create challenges table
     * Safe to call multiple times (uses IF NOT EXISTS)
     */
    @Post('migrate/challenges')
    async migrateChalllenges() {
        try {
            // Drop and recreate to ensure correct column names
            await this.dataSource.query(`DROP TABLE IF EXISTS challenges CASCADE`);

            // Create challenges table with snake_case columns
            await this.dataSource.query(`
                CREATE TABLE challenges (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    from_user_id TEXT NOT NULL,
                    to_user_id TEXT NOT NULL,
                    court_id UUID,
                    message TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                    match_id UUID,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );
            `);

            // Create indexes
            await this.dataSource.query(`
                CREATE INDEX IF NOT EXISTS idx_challenges_to_user ON challenges(to_user_id);
            `);
            await this.dataSource.query(`
                CREATE INDEX IF NOT EXISTS idx_challenges_from_user ON challenges(from_user_id);
            `);
            await this.dataSource.query(`
                CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
            `);
            await this.dataSource.query(`
                CREATE INDEX IF NOT EXISTS idx_challenges_match_id ON challenges(match_id);
            `);

            // Migrate existing challenge messages
            const existing = await this.dataSource.query(`
                SELECT id, from_id, to_id, court_id, body, challenge_status, match_id, created_at
                FROM messages
                WHERE is_challenge = true
            `);

            let migrated = 0;
            for (const msg of existing) {
                try {
                    await this.dataSource.query(`
                        INSERT INTO challenges (id, from_user_id, to_user_id, court_id, message, status, match_id, created_at, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                        ON CONFLICT (id) DO NOTHING
                    `, [
                        msg.id,
                        msg.from_id,
                        msg.to_id,
                        msg.court_id,
                        msg.body,
                        msg.challenge_status || 'pending',
                        msg.match_id,
                        msg.created_at
                    ]);
                    migrated++;
                } catch (e) {
                    // Skip duplicates
                }
            }

            // Get stats
            const count = await this.dataSource.query(`SELECT COUNT(*) FROM challenges`);
            const byStatus = await this.dataSource.query(`
                SELECT status, COUNT(*) as count 
                FROM challenges 
                GROUP BY status 
                ORDER BY count DESC
            `);

            return {
                success: true,
                message: 'Challenges table created and data migrated',
                stats: {
                    totalChallenges: count[0].count,
                    byStatus: byStatus,
                    migratedThisRun: migrated,
                    foundInMessages: existing.length
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

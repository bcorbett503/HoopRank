import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class RunsService {
    constructor(private dataSource: DataSource) { }

    // Get courts that have upcoming scheduled runs
    // Queries player_status table for statuses with scheduledAt in the future
    async getCourtsWithRuns(todayOnly: boolean = false): Promise<{ courtId: string }[]> {
        const now = new Date();

        let query: string;
        let params: any[];

        if (todayOnly) {
            // Get courts with runs scheduled for today (from now until end of day)
            const endOfDay = new Date(now);
            endOfDay.setHours(23, 59, 59, 999);

            query = `
                SELECT DISTINCT court_id as "courtId"
                FROM player_statuses
                WHERE scheduled_at IS NOT NULL
                  AND court_id IS NOT NULL
                  AND scheduled_at >= $1
                  AND scheduled_at <= $2
            `;
            params = [now.toISOString(), endOfDay.toISOString()];
        } else {
            // Get all courts with any upcoming scheduled runs
            query = `
                SELECT DISTINCT court_id as "courtId"
                FROM player_statuses
                WHERE scheduled_at IS NOT NULL
                  AND court_id IS NOT NULL
                  AND scheduled_at >= $1
            `;
            params = [now.toISOString()];
        }

        try {
            const results = await this.dataSource.query(query, params);
            return results || [];
        } catch (error) {
            console.error('RunsService.getCourtsWithRuns error:', error.message);
            return [];
        }
    }
}

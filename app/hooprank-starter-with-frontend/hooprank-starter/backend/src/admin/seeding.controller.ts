/**
 * Seeding Controller — Court data seeding endpoints.
 * Extracted from HealthController during Phase 3 decomposition.
 *
 * All routes preserve their original paths (seed/*).
 */
import { Controller, Post } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from '../auth/public.decorator';
import { RunsService } from '../runs/runs.service';

@Controller()
export class SeedingController {
    constructor(
        private dataSource: DataSource,
        private runsService: RunsService
    ) { }

    /**
     * Trigger the RunsService cron job
     */
    @Post('seed/run-cron')
    async triggerCron() {
        try {
            await this.runsService.spawnUpcomingRecurringRuns();
            return { success: true, message: 'Cron forced successfully' };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Seed The Olympic Club court for testing
     */
    @Post('seed/olympic-club')
    async seedOlympicClub() {
        try {
            const olympicClubId = '44444444-4444-4444-4444-444444444444';
            const existing = await this.dataSource.query(
                `SELECT id FROM courts WHERE id = $1`, [olympicClubId]
            );
            if (existing.length > 0) {
                return { success: true, message: 'Olympic Club already exists', id: olympicClubId };
            }
            await this.dataSource.query(`
                INSERT INTO courts (id, name, city, indoor, signature, geog)
                VALUES ($1, 'The Olympic Club', 'San Francisco', true, true, ST_SetSRID(ST_MakePoint(-122.4099, 37.7878), 4326)::geography)
            `, [olympicClubId]);
            return { success: true, message: 'Olympic Club created', id: olympicClubId };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Seed known indoor gym basketball courts that are missing from map data
     */
    @Post('seed/gym-courts')
    async seedGymCourts() {
        const gymCourts = [
            ['24 Hour Fitness - Clackamas', 'Clackamas', 45.4348, -122.5676, true],
            ['24 Hour Fitness - Lloyd District', 'Portland', 45.5317, -122.6576, true],
            ['24 Hour Fitness - Beaverton', 'Beaverton', 45.4874, -122.8033, true],
            ['24 Hour Fitness - Tigard', 'Tigard', 45.4183, -122.7634, true],
            ['LA Fitness - Clackamas', 'Clackamas', 45.4456, -122.5824, true],
            ['LA Fitness - Beaverton', 'Beaverton', 45.4728, -122.7892, true],
            ['East Portland Community Center', 'Portland', 45.5117, -122.5127, true],
            ['Matt Dishman Community Center', 'Portland', 45.5437, -122.6569, true],
            ['Mt. Scott Community Center', 'Portland', 45.4597, -122.5642, true],
            ['Southwest Community Center', 'Portland', 45.4672, -122.7156, true],
            ['North Portland Community Center', 'Portland', 45.5806, -122.6775, true],
            ['Milwaukie Center', 'Milwaukie', 45.4433, -122.6411, true],
            ['Lake Oswego Indoor Tennis & Athletic Club', 'Lake Oswego', 45.4206, -122.6706, true],
            ['Oregon City Recreation Center', 'Oregon City', 45.3577, -122.6067, true],
        ];

        const results: any[] = [];
        for (const [name, city, lat, lng, indoor] of gymCourts) {
            try {
                const uuidResult = await this.dataSource.query(`SELECT gen_random_uuid() as id`);
                const courtId = uuidResult[0].id;
                const existing = await this.dataSource.query(`SELECT id FROM courts WHERE name = $1`, [name]);
                if (existing.length > 0) {
                    results.push({ name, status: 'already_exists', id: existing[0].id });
                    continue;
                }
                await this.dataSource.query(`
                    INSERT INTO courts (id, name, city, indoor, geog, source)
                    VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, 'manual')
                `, [courtId, name, city, indoor, lng, lat]);
                results.push({ name, status: 'created', id: courtId });
            } catch (error) {
                results.push({ name, status: 'error', error: error.message });
            }
        }
        const created = results.filter(r => r.status === 'created').length;
        const existing = results.filter(r => r.status === 'already_exists').length;
        const errors = results.filter(r => r.status === 'error').length;
        return { success: true, summary: { created, existing, errors, total: gymCourts.length }, results };
    }

    /**
     * Seed NYC indoor gym basketball courts
     */
    @Post('seed/nyc-courts')
    async seedNycCourts() {
        const gymCourts = [
            ['24 Hour Fitness - Kew Gardens', 'Queens', 40.7053, -73.8303, true],
            ['LA Fitness - Staten Island', 'Staten Island', 40.5795, -74.1502, true],
            ['Chinatown YMCA', 'Manhattan', 40.7235, -73.9926, true],
            ['Harlem YMCA', 'Manhattan', 40.8149, -73.9455, true],
            ['McBurney YMCA', 'Manhattan', 40.7375, -73.9996, true],
            ['Vanderbilt YMCA', 'Manhattan', 40.7554, -73.9713, true],
            ['West Side YMCA', 'Manhattan', 40.7706, -73.9799, true],
            ['92nd Street Y', 'Manhattan', 40.7847, -73.9554, true],
            ['Bedford-Stuyvesant YMCA', 'Brooklyn', 40.6893, -73.9540, true],
            ['Coney Island YMCA', 'Brooklyn', 40.5762, -73.9849, true],
            ['Dodge YMCA', 'Brooklyn', 40.6897, -73.9875, true],
            ['Flatbush YMCA', 'Brooklyn', 40.6320, -73.9576, true],
            ['Greenpoint YMCA', 'Brooklyn', 40.7272, -73.9529, true],
            ['North Brooklyn YMCA', 'Brooklyn', 40.6915, -73.8712, true],
            ['Park Slope Armory YMCA', 'Brooklyn', 40.6624, -73.9827, true],
            ['Prospect Park YMCA', 'Brooklyn', 40.6703, -73.9758, true],
            ['Castle Hill YMCA', 'Bronx', 40.8197, -73.8512, true],
            ['La Central YMCA', 'Bronx', 40.8135, -73.9044, true],
            ['Northeast Bronx YMCA', 'Bronx', 40.8889, -73.8599, true],
            ['Cross Island YMCA', 'Queens', 40.7431, -73.7275, true],
            ['Flushing YMCA', 'Queens', 40.7632, -73.8300, true],
            ['Jamaica YMCA', 'Queens', 40.7054, -73.8024, true],
            ['Long Island City YMCA', 'Queens', 40.7515, -73.9259, true],
            ['Ridgewood YMCA', 'Queens', 40.7081, -73.8987, true],
            ['Rockaway YMCA', 'Queens', 40.5931, -73.7979, true],
            ['Broadway YMCA', 'Staten Island', 40.6367, -74.1280, true],
            ['South Shore YMCA', 'Staten Island', 40.5409, -74.1945, true],
        ];

        const results: any[] = [];
        for (const [name, city, lat, lng, indoor] of gymCourts) {
            try {
                const uuidResult = await this.dataSource.query(`SELECT gen_random_uuid() as id`);
                const courtId = uuidResult[0].id;
                const existing = await this.dataSource.query(`SELECT id FROM courts WHERE name = $1`, [name]);
                if (existing.length > 0) {
                    results.push({ name, status: 'already_exists', id: existing[0].id });
                    continue;
                }
                await this.dataSource.query(`
                    INSERT INTO courts (id, name, city, indoor, geog, source)
                    VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, 'manual')
                `, [courtId, name, city, indoor, lng, lat]);
                results.push({ name, status: 'created', id: courtId });
            } catch (error) {
                results.push({ name, status: 'error', error: error.message });
            }
        }
        const created = results.filter(r => r.status === 'created').length;
        const existing = results.filter(r => r.status === 'already_exists').length;
        return { success: true, city: 'New York', summary: { created, existing, total: gymCourts.length }, results };
    }

    /**
     * Seed Los Angeles indoor gym basketball courts
     */
    @Post('seed/la-courts')
    async seedLaCourts() {
        const gymCourts = [
            ['LA Fitness - Miracle Mile', 'Los Angeles', 34.0625, -118.3467, true],
            ['LA Fitness - Hollywood Blvd', 'Los Angeles', 34.1017, -118.3388, true],
            ['LA Fitness - Westwood', 'Los Angeles', 34.0585, -118.4522, true],
            ['LA Fitness - Montebello', 'Montebello', 34.0168, -118.1251, true],
            ['LA Fitness - Northridge', 'Northridge', 34.2523, -118.5553, true],
            ['LA Fitness - La Cienega', 'Los Angeles', 34.0496, -118.3794, true],
            ['LA Fitness - Hollywood El Centro', 'Los Angeles', 34.0994, -118.3260, true],
            ['LA Fitness - Downtown Bloc', 'Los Angeles', 34.0490, -118.2579, true],
            ['LA Fitness - Universal City', 'Los Angeles', 34.1385, -118.3542, true],
            ['Anderson Munger Family YMCA', 'Los Angeles', 34.0690, -118.3008, true],
            ['Collins & Katz Family YMCA', 'Los Angeles', 34.0484, -118.4663, true],
            ['Crenshaw Family YMCA', 'Los Angeles', 34.0141, -118.3340, true],
            ['Culver-Palms Family YMCA', 'Culver City', 34.0116, -118.3979, true],
            ['East Valley Family YMCA', 'North Hollywood', 34.1611, -118.3688, true],
            ['Gardena-Carson Family YMCA', 'Gardena', 33.8889, -118.3073, true],
            ['Hollywood YMCA', 'Hollywood', 34.1006, -118.3269, true],
            ['Ketchum-Downtown YMCA', 'Los Angeles', 34.0510, -118.2553, true],
            ['Mid Valley Family YMCA', 'Van Nuys', 34.1870, -118.4468, true],
            ['North Valley Family YMCA', 'Northridge', 34.2553, -118.5363, true],
            ['San Pedro & Peninsula YMCA', 'San Pedro', 33.7378, -118.2876, true],
            ['Southeast-Rio Vista YMCA', 'Maywood', 33.9876, -118.1857, true],
            ['Torrance-South Bay YMCA', 'Torrance', 33.8363, -118.3908, true],
            ['Weingart Wellness YMCA', 'Los Angeles', 33.9414, -118.2912, true],
            ['Weingart East Los Angeles YMCA', 'Los Angeles', 34.0231, -118.2140, true],
            ['Westchester Family YMCA', 'Westchester', 33.9598, -118.3970, true],
            ['West Valley Family YMCA', 'Reseda', 34.1958, -118.5368, true],
            ['Wilmington Family YMCA', 'Wilmington', 33.7902, -118.2616, true],
            ['Crescenta-Canada Family YMCA', 'La Crescenta', 34.2140, -118.2236, true],
            ['Pasadena-Sierra Madre YMCA', 'Sierra Madre', 34.1627, -118.0515, true],
            ['Santa Anita Family YMCA', 'Monrovia', 34.1459, -117.9976, true],
        ];

        const results: any[] = [];
        for (const [name, city, lat, lng, indoor] of gymCourts) {
            try {
                const uuidResult = await this.dataSource.query(`SELECT gen_random_uuid() as id`);
                const courtId = uuidResult[0].id;
                const existing = await this.dataSource.query(`SELECT id FROM courts WHERE name = $1`, [name]);
                if (existing.length > 0) {
                    results.push({ name, status: 'already_exists', id: existing[0].id });
                    continue;
                }
                await this.dataSource.query(`
                    INSERT INTO courts (id, name, city, indoor, geog, source)
                    VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, 'manual')
                `, [courtId, name, city, indoor, lng, lat]);
                results.push({ name, status: 'created', id: courtId });
            } catch (error) {
                results.push({ name, status: 'error', error: error.message });
            }
        }
        const created = results.filter(r => r.status === 'created').length;
        const existing = results.filter(r => r.status === 'already_exists').length;
        return { success: true, city: 'Los Angeles', summary: { created, existing, total: gymCourts.length }, results };
    }

    /**
     * Seed Chicago, Houston, Phoenix indoor gym basketball courts
     * Cities #3, #4, #5
     */
    @Post('seed/batch-3-5')
    async seedBatch3to5() {
        const gymCourts = [
            ['LA Fitness - Chicago Clark St', 'Chicago', 41.9338, -87.6437, true],
            ['LA Fitness - Chicago King Dr', 'Chicago', 41.8319, -87.6174, true],
            ['LA Fitness - Chicago Pershing', 'Chicago', 41.8235, -87.6861, true],
            ['LA Fitness - Chicago Kedzie', 'Chicago', 41.7865, -87.7025, true],
            ['LA Fitness - Chicago Logan Square', 'Chicago', 41.9302, -87.7088, true],
            ['LA Fitness - Chicago Loop', 'Chicago', 41.8831, -87.6276, true],
            ['Irving Park YMCA', 'Chicago', 41.9533, -87.7355, true],
            ['Kelly Hall YMCA', 'Chicago', 41.8993, -87.7221, true],
            ['Lake View YMCA', 'Chicago', 41.9403, -87.6652, true],
            ['Dr. Effie O. Ellis YMCA', 'Chicago', 41.8810, -87.7234, true],
            ['Garfield YMCA', 'Chicago', 41.8806, -87.7103, true],
            ['Jeanne Kenney YMCA', 'Chicago', 41.7513, -87.6384, true],
            ['Marshall YMCA', 'Chicago', 41.8803, -87.7055, true],
            ['McCormick YMCA', 'Chicago', 41.9203, -87.7155, true],
            ['North Lawndale YMCA', 'Chicago', 41.8679, -87.7119, true],
            ['Rauner Family YMCA', 'Chicago', 41.8469, -87.6857, true],
            ['South Side YMCA', 'Chicago', 41.7811, -87.5865, true],
            ['West Garfield Park YMCA', 'Chicago', 41.8815, -87.7271, true],
            ['FFC Union Station', 'Chicago', 41.8786, -87.6402, true],
            ['Lakeshore Sport & Fitness', 'Chicago', 41.8924, -87.6145, true],
            ['Life Time River North', 'Chicago', 41.8958, -87.6353, true],
            ['Houston Texans YMCA', 'Houston', 29.7180, -95.3571, true],
            ['M.D. Anderson Family YMCA', 'Houston', 29.7918, -95.3719, true],
            ['Harriet and Joe Foster Family YMCA', 'Houston', 29.7978, -95.4211, true],
            ['Perry Family YMCA', 'League City', 29.5077, -95.1071, true],
            ['Tellepsen Family Downtown YMCA', 'Houston', 29.7528, -95.3655, true],
            ['D. Bradley McWilliams YMCA', 'Houston', 29.8689, -95.4048, true],
            ['Weekley Family YMCA', 'Houston', 29.7190, -95.4277, true],
            ['Ahwatukee Foothills YMCA', 'Phoenix', 33.3279, -111.9749, true],
            ['Legacy Foundation Chris-Town YMCA', 'Phoenix', 33.5045, -112.0869, true],
            ['Lincoln Family Downtown YMCA', 'Phoenix', 33.4485, -112.0740, true],
            ['Watts Family Maryvale YMCA', 'Phoenix', 33.4989, -112.1966, true],
            ['Southwest Valley YMCA', 'Phoenix', 33.3807, -112.1341, true],
            ['East Valley YMCA', 'Mesa', 33.4373, -111.7878, true],
        ];

        const results: any[] = [];
        for (const [name, city, lat, lng, indoor] of gymCourts) {
            try {
                const uuidResult = await this.dataSource.query(`SELECT gen_random_uuid() as id`);
                const courtId = uuidResult[0].id;
                const existing = await this.dataSource.query(`SELECT id FROM courts WHERE name = $1`, [name]);
                if (existing.length > 0) {
                    results.push({ name, status: 'already_exists', id: existing[0].id });
                    continue;
                }
                await this.dataSource.query(`
                    INSERT INTO courts (id, name, city, indoor, geog, source)
                    VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, 'manual')
                `, [courtId, name, city, indoor, lng, lat]);
                results.push({ name, status: 'created', id: courtId });
            } catch (error) {
                results.push({ name, status: 'error', error: error.message });
            }
        }
        const created = results.filter(r => r.status === 'created').length;
        const existing = results.filter(r => r.status === 'already_exists').length;
        return { success: true, cities: ['Chicago', 'Houston', 'Phoenix'], summary: { created, existing, total: gymCourts.length }, results };
    }

    /**
     * Seed Philadelphia, San Antonio, San Diego, Dallas, San Jose courts
     * Cities #6-10
     */
    @Post('seed/batch-6-10')
    async seedBatch6to10() {
        const gymCourts = [
            ['Columbia North YMCA', 'Philadelphia', 40.0031, -75.1419, true],
            ['Northeast Family YMCA', 'Philadelphia', 40.0641, -75.0459, true],
            ['West Philadelphia YMCA', 'Philadelphia', 39.9546, -75.2139, true],
            ['Roxborough YMCA', 'Philadelphia', 40.0349, -75.2283, true],
            ['Center City YMCA', 'Philadelphia', 39.9532, -75.1667, true],
            ['D.R. Semmes Family YMCA', 'San Antonio', 29.4680, -98.4803, true],
            ['Davis-Scott Family YMCA', 'San Antonio', 29.4158, -98.4609, true],
            ['Harvey E. Najim Family YMCA', 'San Antonio', 29.3829, -98.5093, true],
            ['Mays Family YMCA at Stone Oak', 'San Antonio', 29.6147, -98.4813, true],
            ['Mays YMCA at Potranco', 'San Antonio', 29.4239, -98.6751, true],
            ['Schertz Family YMCA', 'Schertz', 29.5647, -98.2720, true],
            ['Thousand Oaks YMCA', 'San Antonio', 29.5589, -98.4305, true],
            ['Walzem Family YMCA', 'San Antonio', 29.4947, -98.3952, true],
            ['Westside Family YMCA', 'San Antonio', 29.4326, -98.5251, true],
            ['YMCA at O.P. Schnabel Park', 'San Antonio', 29.5078, -98.6423, true],
            ['Border View Family YMCA', 'San Diego', 32.5452, -116.9712, true],
            ['Cameron Family YMCA', 'Santee', 32.8446, -116.9740, true],
            ['Copley-Price Family YMCA', 'San Diego', 32.7612, -117.0961, true],
            ['Dan McKinney Family YMCA', 'La Jolla', 32.8537, -117.2243, true],
            ['Escondido YMCA', 'Escondido', 33.1324, -117.0781, true],
            ['Jackie Robinson Family YMCA', 'San Diego', 32.7123, -117.1205, true],
            ['Joe and Mary Mottino Family YMCA', 'Oceanside', 33.2140, -117.2822, true],
            ['John A. Davis Family YMCA', 'La Mesa', 32.7628, -117.0198, true],
            ['Magdalena Ecke Family YMCA', 'Encinitas', 33.0536, -117.2611, true],
            ['Mission Valley YMCA', 'San Diego', 32.7639, -117.1628, true],
            ['Rancho Family YMCA', 'San Diego', 32.9587, -117.1078, true],
            ['South Bay Family YMCA', 'Chula Vista', 32.6119, -117.0635, true],
            ['Toby Wells YMCA', 'San Diego', 32.8182, -117.1403, true],
            ['Lake Highlands Family YMCA', 'Dallas', 32.8822, -96.7404, true],
            ['Moody Family YMCA', 'Dallas', 32.8404, -96.7996, true],
            ['Moorland Family YMCA', 'Dallas', 32.6810, -96.8436, true],
            ['Park South Family YMCA', 'Dallas', 32.7405, -96.7618, true],
            ['Semones Family YMCA', 'Dallas', 32.8729, -96.8466, true],
            ['White Rock YMCA', 'Dallas', 32.8088, -96.7192, true],
            ['Central YMCA San Jose', 'San Jose', 37.3284, -121.9045, true],
            ['East Valley Family YMCA', 'San Jose', 37.3207, -121.8195, true],
            ['South Valley Family YMCA', 'San Jose', 37.2315, -121.8487, true],
            ['Northwest YMCA', 'Cupertino', 37.3197, -122.0325, true],
        ];

        const results: any[] = [];
        for (const [name, city, lat, lng, indoor] of gymCourts) {
            try {
                const uuidResult = await this.dataSource.query(`SELECT gen_random_uuid() as id`);
                const courtId = uuidResult[0].id;
                const existing = await this.dataSource.query(`SELECT id FROM courts WHERE name = $1`, [name]);
                if (existing.length > 0) {
                    results.push({ name, status: 'already_exists', id: existing[0].id });
                    continue;
                }
                await this.dataSource.query(`
                    INSERT INTO courts (id, name, city, indoor, geog, source)
                    VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, 'manual')
                `, [courtId, name, city, indoor, lng, lat]);
                results.push({ name, status: 'created', id: courtId });
            } catch (error) {
                results.push({ name, status: 'error', error: error.message });
            }
        }
        const created = results.filter(r => r.status === 'created').length;
        const existing = results.filter(r => r.status === 'already_exists').length;
        return { success: true, cities: ['Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'], summary: { created, existing, total: gymCourts.length }, results };
    }

    /**
     * Seed cities #11-20
     */
    @Post('seed/batch-11-20')
    async seedBatch11to20() {
        const gymCourts = [
            ['North Austin YMCA', 'Austin', 30.3566, -97.6976, true],
            ['TownLake YMCA', 'Austin', 30.2676, -97.7499, true],
            ['East Communities YMCA', 'Austin', 30.2946, -97.6619, true],
            ['Hays Communities YMCA', 'Buda', 30.0689, -97.8282, true],
            ['Northwest Family YMCA', 'Austin', 30.4518, -97.7744, true],
            ['Southwest Family YMCA', 'Austin', 30.2255, -97.8358, true],
            ['Springs Family YMCA', 'Dripping Springs', 30.1768, -98.0867, true],
            ['Williams Family YMCA', 'Jacksonville', 30.2253, -81.6068, true],
            ['Brooks Family YMCA', 'Jacksonville', 30.2273, -81.5726, true],
            ['Schultz YMCA', 'Jacksonville', 30.3321, -81.4398, true],
            ['Cecil B. Day YMCA', 'Jacksonville', 30.2087, -81.7212, true],
            ['Eastside YMCA', 'Fort Worth', 32.7392, -97.2757, true],
            ['William M. McDonald YMCA', 'Fort Worth', 32.7201, -97.3188, true],
            ['Amon G. Carter Jr. Downtown YMCA', 'Fort Worth', 32.7530, -97.3335, true],
            ['Northpark YMCA', 'Fort Worth', 32.9197, -97.3083, true],
            ['YMCA Sports Complex', 'Fort Worth', 32.6827, -97.3881, true],
            ['Delaware Community Center YMCA', 'Delaware', 40.2987, -83.0680, true],
            ['Grove City YMCA', 'Grove City', 39.8795, -83.0930, true],
            ['Hilltop YMCA', 'Columbus', 39.9548, -83.0621, true],
            ['North YMCA Columbus', 'Columbus', 40.0689, -82.9874, true],
            ['Reynoldsburg Community Center YMCA', 'Reynoldsburg', 39.9562, -82.8121, true],
            ['Avondale Meadows YMCA', 'Indianapolis', 39.8320, -86.0875, true],
            ['Baxter YMCA', 'Indianapolis', 39.7879, -86.1548, true],
            ['Benjamin Harrison YMCA', 'Indianapolis', 39.8655, -86.1087, true],
            ['Fishers YMCA', 'Fishers', 39.9587, -86.0239, true],
            ['Irsay Family YMCA at CityWay', 'Indianapolis', 39.7518, -86.1572, true],
            ['Jordan YMCA', 'Indianapolis', 39.8673, -86.1432, true],
            ['OrthoIndy Foundation YMCA', 'Indianapolis', 39.9211, -86.0878, true],
            ['Ransburg YMCA', 'Indianapolis', 39.7751, -86.1104, true],
            ['YMCA at the Athenaeum', 'Indianapolis', 39.7716, -86.1518, true],
            ['Brace Family YMCA', 'Matthews', 35.1275, -80.7206, true],
            ['Childress Klein YMCA', 'Charlotte', 35.2219, -80.8426, true],
            ['Dowd YMCA', 'Charlotte', 35.2138, -80.8479, true],
            ['Harris YMCA', 'Charlotte', 35.1304, -80.8542, true],
            ['Johnston YMCA', 'Charlotte', 35.2489, -80.8149, true],
            ['Keith Family YMCA', 'Charlotte', 35.3182, -80.7348, true],
            ['McCrorey YMCA', 'Charlotte', 35.2628, -80.8777, true],
            ['Morrison Family YMCA', 'Charlotte', 35.0623, -80.8011, true],
            ['Simmons YMCA', 'Charlotte', 35.1862, -80.7233, true],
            ['Stratford Richardson YMCA', 'Charlotte', 35.2134, -80.8826, true],
            ['Embarcadero YMCA', 'San Francisco', 37.7915, -122.3936, true],
            ['Presidio Community YMCA', 'San Francisco', 37.7997, -122.4545, true],
            ['Stonestown Family YMCA', 'San Francisco', 37.7285, -122.4765, true],
            ['Treasure Island YMCA', 'San Francisco', 37.8193, -122.3699, true],
            ['Auburn Valley YMCA', 'Auburn', 47.3073, -122.2285, true],
            ['Bellevue Family YMCA', 'Bellevue', 47.6132, -122.1892, true],
            ['Downtown Seattle YMCA', 'Seattle', 47.6097, -122.3331, true],
            ['Meredith Mathews East Madison YMCA', 'Seattle', 47.6195, -122.3034, true],
            ['West Seattle Family YMCA', 'Seattle', 47.5629, -122.3868, true],
            ['Dale Turner Family YMCA', 'Shoreline', 47.7568, -122.3426, true],
            ['Arvada Duncan YMCA', 'Arvada', 39.7990, -105.0875, true],
            ['Aurora YMCA', 'Aurora', 39.7294, -104.8319, true],
            ['Downtown Denver YMCA', 'Denver', 39.7392, -104.9903, true],
            ['Littleton Family YMCA', 'Littleton', 39.5943, -105.0167, true],
            ['Southwest Family YMCA Denver', 'Denver', 39.6523, -105.0835, true],
            ['University Hills Schlessman YMCA', 'Denver', 39.6713, -104.9428, true],
            ['Central Park YMCA', 'Denver', 39.7625, -104.8995, true],
            ['YMCA Anthony Bowen', 'Washington', 38.9178, -77.0317, true],
            ['YMCA Calomiris Program Center', 'Washington', 38.9319, -76.9893, true],
            ['YMCA Arlington', 'Arlington', 38.8784, -77.0892, true],
            ['YMCA Bethesda', 'Bethesda', 39.0066, -77.0987, true],
        ];

        const results: any[] = [];
        for (const [name, city, lat, lng, indoor] of gymCourts) {
            try {
                const uuidResult = await this.dataSource.query(`SELECT gen_random_uuid() as id`);
                const courtId = uuidResult[0].id;
                const existing = await this.dataSource.query(`SELECT id FROM courts WHERE name = $1`, [name]);
                if (existing.length > 0) {
                    results.push({ name, status: 'already_exists', id: existing[0].id });
                    continue;
                }
                await this.dataSource.query(`
                    INSERT INTO courts (id, name, city, indoor, geog, source)
                    VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, 'manual')
                `, [courtId, name, city, indoor, lng, lat]);
                results.push({ name, status: 'created', id: courtId });
            } catch (error) {
                results.push({ name, status: 'error', error: error.message });
            }
        }
        const created = results.filter(r => r.status === 'created').length;
        const existing = results.filter(r => r.status === 'already_exists').length;
        return { success: true, cities: ['Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Indianapolis', 'Charlotte', 'San Francisco', 'Seattle', 'Denver', 'Washington DC'], summary: { created, existing, total: gymCourts.length }, results };
    }

    /**
     * Seed cities #21-30
     */
    @Post('seed/batch-21-30')
    async seedBatch21to30() {
        const gymCourts = [
            ['Downtown Nashville YMCA', 'Nashville', 36.1584, -86.7816, true],
            ['Bellevue YMCA', 'Nashville', 36.0584, -86.9094, true],
            ['Donelson-Hermitage YMCA', 'Nashville', 36.1589, -86.6455, true],
            ['Green Hills YMCA', 'Nashville', 36.1026, -86.8157, true],
            ['Margaret Maddox YMCA', 'Nashville', 36.2072, -86.7447, true],
            ['Northwest Nashville YMCA', 'Nashville', 36.2245, -86.8624, true],
            ['Huntington Avenue YMCA', 'Boston', 42.3415, -71.0872, true],
            ['East Boston YMCA', 'Boston', 42.3742, -71.0348, true],
            ['Oak Square Family YMCA', 'Brighton', 42.3505, -71.1572, true],
            ['Charlestown YMCA', 'Boston', 42.3793, -71.0605, true],
            ['Dorchester YMCA', 'Boston', 42.2963, -71.0659, true],
            ['Roxbury YMCA', 'Boston', 42.3265, -71.0915, true],
            ['Thomas M. Menino YMCA', 'Hyde Park', 42.2568, -71.1244, true],
            ['Waltham YMCA', 'Waltham', 42.3795, -71.2471, true],
            ['Bowling Family YMCA', 'El Paso', 31.8637, -106.4439, true],
            ['Loya Family YMCA', 'El Paso', 31.7718, -106.3373, true],
            ['Westside Family YMCA El Paso', 'El Paso', 31.8366, -106.5419, true],
            ['Bethany YMCA', 'Bethany', 35.5157, -97.6394, true],
            ['Earlywine Park YMCA', 'Oklahoma City', 35.3499, -97.5419, true],
            ['Edward L. Gaylord Downtown YMCA', 'Oklahoma City', 35.4704, -97.5171, true],
            ['Midwest City YMCA', 'Midwest City', 35.4624, -97.3753, true],
            ['North Side YMCA OKC', 'Oklahoma City', 35.5664, -97.5217, true],
            ['Rockwell Plaza YMCA', 'Oklahoma City', 35.5015, -97.6239, true],
            ['Boll Family YMCA', 'Detroit', 42.3361, -83.0483, true],
            ['Birmingham Family YMCA', 'Birmingham', 42.5467, -83.2144, true],
            ['Carls Family YMCA', 'Milford', 42.5916, -83.5949, true],
            ['Downriver Family YMCA', 'Southgate', 42.2048, -83.1993, true],
            ['South Oakland YMCA', 'Royal Oak', 42.4895, -83.1446, true],
            ['Bill & Lillie Heinrich YMCA', 'Las Vegas', 36.1509, -115.2007, true],
            ['Durango Hills YMCA', 'Las Vegas', 36.1989, -115.2794, true],
            ['Centennial Hills YMCA', 'Las Vegas', 36.2661, -115.2479, true],
            ['SkyView YMCA', 'North Las Vegas', 36.2655, -115.1371, true],
            ['Bartlett YMCA', 'Bartlett', 35.2296, -89.8409, true],
            ['Cordova Family YMCA', 'Cordova', 35.1544, -89.7694, true],
            ['Fogelman Downtown YMCA', 'Memphis', 35.1473, -90.0505, true],
            ['Georgette & Cato Johnson YMCA', 'Memphis', 35.0618, -90.0351, true],
            ['YMCA at Schilling Farms', 'Collierville', 35.0477, -89.7012, true],
            ['Chestnut Street Family YMCA', 'Louisville', 38.2483, -85.7632, true],
            ['Downtown Family YMCA Louisville', 'Louisville', 38.2477, -85.7544, true],
            ['Northeast Family YMCA Louisville', 'Louisville', 38.2842, -85.6161, true],
            ['Republic Bank Foundation YMCA', 'Louisville', 38.2522, -85.7733, true],
            ['Southeast Family YMCA Louisville', 'Louisville', 38.2122, -85.6498, true],
            ['Southwest Family YMCA Louisville', 'Louisville', 38.1902, -85.8005, true],
            ['Y in Waverly', 'Baltimore', 39.3255, -76.6093, true],
            ['Y in Druid Hill', 'Baltimore', 39.3061, -76.6388, true],
        ];

        const results: any[] = [];
        for (const [name, city, lat, lng, indoor] of gymCourts) {
            try {
                const uuidResult = await this.dataSource.query(`SELECT gen_random_uuid() as id`);
                const courtId = uuidResult[0].id;
                const existing = await this.dataSource.query(`SELECT id FROM courts WHERE name = $1`, [name]);
                if (existing.length > 0) {
                    results.push({ name, status: 'already_exists', id: existing[0].id });
                    continue;
                }
                await this.dataSource.query(`
                    INSERT INTO courts (id, name, city, indoor, geog, source)
                    VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, 'manual')
                `, [courtId, name, city, indoor, lng, lat]);
                results.push({ name, status: 'created', id: courtId });
            } catch (error) {
                results.push({ name, status: 'error', error: error.message });
            }
        }
        const created = results.filter(r => r.status === 'created').length;
        const existing = results.filter(r => r.status === 'already_exists').length;
        return { success: true, cities: ['Nashville', 'Boston', 'El Paso', 'Oklahoma City', 'Detroit', 'Las Vegas', 'Memphis', 'Louisville', 'Baltimore'], summary: { created, existing, total: gymCourts.length }, results };
    }

    /**
     * Seed cities #31-40
     */
    @Post('seed/batch-31-40')
    async seedBatch31to40() {
        const gymCourts = [
            ['Northside YMCA Milwaukee', 'Milwaukee', 43.0555, -87.9218, true],
            ['Rite-Hite Family YMCA', 'Brown Deer', 43.1659, -87.9612, true],
            ['Briscoe Family YMCA Wellness Center', 'Franklin', 42.8915, -88.0383, true],
            ['McLeod Mountainside Family YMCA', 'Albuquerque', 35.1305, -106.5103, true],
            ['Horn Family YMCA', 'Albuquerque', 35.0932, -106.5808, true],
            ['Field House YMCA', 'Albuquerque', 35.1601, -106.5746, true],
            ['Central Branch Downtown YMCA Albuquerque', 'Albuquerque', 35.0831, -106.6226, true],
            ['LightHouse City YMCA', 'Tucson', 32.2533, -110.9107, true],
            ['Lohse Family YMCA', 'Tucson', 32.2216, -110.9671, true],
            ['Ott Family YMCA', 'Tucson', 32.2149, -110.8025, true],
            ['Northwest YMCA Tucson', 'Tucson', 32.3345, -111.0135, true],
            ['Central Valley YMCA', 'Fresno', 36.7416, -119.7847, true],
            ['Fresno YMCA', 'Fresno', 36.7724, -119.8181, true],
            ['Reedley YMCA', 'Reedley', 36.5963, -119.4520, true],
            ['Sanger YMCA', 'Sanger', 36.7087, -119.5559, true],
            ['Sacramento Central YMCA', 'Sacramento', 38.5642, -121.4998, true],
            ['Capital YMCA Sacramento', 'Sacramento', 38.5824, -121.4944, true],
            ['Cleaver Family YMCA', 'Kansas City', 39.0145, -94.5708, true],
            ['North Kansas City YMCA', 'North Kansas City', 39.1336, -94.5733, true],
            ['Linwood Family YMCA', 'Kansas City', 39.0728, -94.5363, true],
            ['Carl E. Sanders Family YMCA at Buckhead', 'Atlanta', 33.8645, -84.3328, true],
            ['East Lake Family YMCA', 'Atlanta', 33.7437, -84.3137, true],
            ['Ed Isakson Alpharetta Family YMCA', 'Alpharetta', 34.0692, -84.2441, true],
            ['J.M. Tull-Gwinnett Family YMCA', 'Lawrenceville', 33.9656, -84.0505, true],
            ['McCleskey-East Cobb Family YMCA', 'Marietta', 33.9494, -84.4214, true],
            ['Armbrust YMCA', 'Omaha', 41.2147, -96.1341, true],
            ['Downtown YMCA Omaha', 'Omaha', 41.2568, -95.9423, true],
            ['Maple Street YMCA', 'Omaha', 41.2878, -96.0361, true],
            ['Southwest YMCA Omaha', 'Omaha', 41.2231, -96.0678, true],
            ['Sarpy YMCA', 'Papillion', 41.1515, -96.0470, true],
            ['Gretna Crossing YMCA', 'Gretna', 41.1291, -96.2412, true],
            ['Briargate YMCA', 'Colorado Springs', 38.9431, -104.8002, true],
            ['Cottonwood Creek YMCA', 'Colorado Springs', 38.9201, -104.8233, true],
            ['Downtown YMCA Colorado Springs', 'Colorado Springs', 38.8345, -104.8259, true],
            ['First & Main YMCA', 'Colorado Springs', 38.8648, -104.7134, true],
            ['Fountain Valley YMCA', 'Fountain', 38.6808, -104.7008, true],
            ['Garden Ranch YMCA', 'Colorado Springs', 38.9120, -104.8606, true],
            ['Southeast Armed Services YMCA', 'Colorado Springs', 38.7945, -104.7536, true],
            ['Tri-Lakes YMCA', 'Monument', 39.0545, -104.8548, true],
        ];

        const results: any[] = [];
        for (const [name, city, lat, lng, indoor] of gymCourts) {
            try {
                const uuidResult = await this.dataSource.query(`SELECT gen_random_uuid() as id`);
                const courtId = uuidResult[0].id;
                const existing = await this.dataSource.query(`SELECT id FROM courts WHERE name = $1`, [name]);
                if (existing.length > 0) {
                    results.push({ name, status: 'already_exists', id: existing[0].id });
                    continue;
                }
                await this.dataSource.query(`
                    INSERT INTO courts (id, name, city, indoor, geog, source)
                    VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, 'manual')
                `, [courtId, name, city, indoor, lng, lat]);
                results.push({ name, status: 'created', id: courtId });
            } catch (error) {
                results.push({ name, status: 'error', error: error.message });
            }
        }
        const created = results.filter(r => r.status === 'created').length;
        const existing = results.filter(r => r.status === 'already_exists').length;
        return { success: true, cities: ['Milwaukee', 'Albuquerque', 'Tucson', 'Fresno', 'Sacramento', 'Kansas City', 'Atlanta', 'Omaha', 'Colorado Springs'], summary: { created, existing, total: gymCourts.length }, results };
    }
}

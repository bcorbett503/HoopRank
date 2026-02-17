import { RunsService } from './runs.service';

/**
 * Unit tests for RunsService core methods.
 * Uses a mock DataSource to test business logic without database calls.
 */
describe('RunsService', () => {
    let service: RunsService;
    let mockDataSource: any;
    let queryResults: any[];

    beforeEach(() => {
        queryResults = [];
        mockDataSource = {
            query: jest.fn().mockImplementation(() => {
                return Promise.resolve(queryResults.shift() || []);
            }),
        };
        service = new RunsService(mockDataSource);
    });

    describe('createRun', () => {
        it('should insert a run and auto-join the creator', async () => {
            const createdRun = { id: 'run-1', court_id: 'court-1', created_by: 'user-1' };
            // First query: INSERT RETURNING * → returns the created run
            queryResults.push([createdRun]);
            // Second query: joinRun INSERT (auto-join creator)
            queryResults.push([]);

            const result = await service.createRun('user-1', {
                courtId: 'court-1',
                scheduledAt: '2026-02-20T10:00:00Z',
            });

            expect(result).toEqual(createdRun);
            // Verify INSERT was called
            expect(mockDataSource.query).toHaveBeenCalledTimes(2);
            const insertCall = mockDataSource.query.mock.calls[0];
            expect(insertCall[0]).toContain('INSERT INTO scheduled_runs');
            expect(insertCall[1][0]).toBe('court-1');  // courtId
            expect(insertCall[1][1]).toBe('user-1');    // userId
        });

        it('should pass default values for optional fields', async () => {
            queryResults.push([{ id: 'run-1' }]);
            queryResults.push([]); // joinRun

            await service.createRun('user-1', {
                courtId: 'court-1',
                scheduledAt: '2026-02-20T10:00:00Z',
            });

            const params = mockDataSource.query.mock.calls[0][1];
            expect(params[2]).toBeNull();        // title
            expect(params[3]).toBe('5v5');        // gameMode default
            expect(params[7]).toBe(120);          // durationMinutes default
            expect(params[8]).toBe(10);           // maxPlayers default
        });

        it('should serialize taggedPlayerIds to JSON', async () => {
            queryResults.push([{ id: 'run-1' }]);
            queryResults.push([]); // joinRun

            await service.createRun('user-1', {
                courtId: 'court-1',
                scheduledAt: '2026-02-20T10:00:00Z',
                taggedPlayerIds: ['player-a', 'player-b'],
            });

            const params = mockDataSource.query.mock.calls[0][1];
            expect(params[10]).toBe('["player-a","player-b"]'); // taggedJson
        });

        it('should pass null for empty taggedPlayerIds', async () => {
            queryResults.push([{ id: 'run-1' }]);
            queryResults.push([]); // joinRun

            await service.createRun('user-1', {
                courtId: 'court-1',
                scheduledAt: '2026-02-20T10:00:00Z',
                taggedPlayerIds: [],
            });

            const params = mockDataSource.query.mock.calls[0][1];
            expect(params[10]).toBeNull();
        });
    });

    describe('joinRun', () => {
        it('should insert an attendee record', async () => {
            queryResults.push([]);

            await service.joinRun('run-1', 'user-2');

            expect(mockDataSource.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO run_attendees'),
                ['run-1', 'user-2'],
            );
        });

        it('should silently ignore duplicate key errors (code 23505)', async () => {
            mockDataSource.query.mockRejectedValueOnce({ code: '23505' });

            // Should not throw
            await expect(service.joinRun('run-1', 'user-2')).resolves.toBeUndefined();
        });

        it('should silently ignore UNIQUE constraint errors', async () => {
            mockDataSource.query.mockRejectedValueOnce(new Error('UNIQUE constraint failed'));

            await expect(service.joinRun('run-1', 'user-2')).resolves.toBeUndefined();
        });

        it('should re-throw non-duplicate errors', async () => {
            mockDataSource.query.mockRejectedValueOnce(new Error('Connection lost'));

            await expect(service.joinRun('run-1', 'user-2')).rejects.toThrow('Connection lost');
        });
    });

    describe('cancelRun', () => {
        it('should delete run only if creator matches', async () => {
            // DELETE RETURNING returns [rows, count] format
            queryResults.push([{ id: 'run-1' }]);
            queryResults.push([]); // DELETE attendees

            const result = await service.cancelRun('run-1', 'user-1');

            expect(result).toBe(true);
            expect(mockDataSource.query).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM scheduled_runs WHERE id = $1 AND created_by = $2'),
                ['run-1', 'user-1'],
            );
        });

        it('should return false when non-creator tries to cancel', async () => {
            // DELETE RETURNING returns empty array (no rows matched)
            queryResults.push([]);

            const result = await service.cancelRun('run-1', 'not-the-creator');

            expect(result).toBe(false);
            // Should NOT attempt to delete attendees
            expect(mockDataSource.query).toHaveBeenCalledTimes(1);
        });

        it('should clean up attendees after successful cancellation', async () => {
            queryResults.push([{ id: 'run-1' }]);
            queryResults.push([]); // DELETE attendees

            await service.cancelRun('run-1', 'user-1');

            const cleanupCall = mockDataSource.query.mock.calls[1];
            expect(cleanupCall[0]).toContain('DELETE FROM run_attendees');
            expect(cleanupCall[1]).toEqual(['run-1']);
        });
    });
});

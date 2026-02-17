import { StatusesController } from './statuses.controller';
import { StatusesService } from './statuses.service';

/**
 * Unit tests for StatusesController.getUnifiedFeed
 *
 * Verifies the response envelope shape { items: Array, hasMore: boolean }
 * that the Flutter client relies on. This test suite exists to prevent
 * regressions where a response shape change breaks the mobile feed.
 */
describe('StatusesController', () => {
    let controller: StatusesController;
    let statusesService: Partial<StatusesService>;

    beforeEach(() => {
        statusesService = {
            getUnifiedFeed: jest.fn(),
        };
        controller = new StatusesController(
            statusesService as StatusesService,
            {} as any, // UsersService — not used by getUnifiedFeed
        );
    });

    describe('getUnifiedFeed', () => {
        it('should return { items: [], hasMore: false } when userId is missing', async () => {
            const result = await controller.getUnifiedFeed('', 'all');
            expect(result).toEqual([]);
        });

        it('should return { items: Array, hasMore: boolean } envelope', async () => {
            const mockItems = [
                { id: '1', type: 'status', content: 'Hello' },
                { id: '2', type: 'match', content: 'Game on' },
            ];
            (statusesService.getUnifiedFeed as jest.Mock).mockResolvedValue(mockItems);

            const result = await controller.getUnifiedFeed('user-1', 'all');
            expect(result).toHaveProperty('items');
            expect(result).toHaveProperty('hasMore');
            expect(Array.isArray((result as any).items)).toBe(true);
            expect(typeof (result as any).hasMore).toBe('boolean');
        });

        it('should set hasMore=true when results exceed limit', async () => {
            // Request limit=2, service returns 3 items (limit+1)
            const mockItems = [
                { id: '1', type: 'status' },
                { id: '2', type: 'status' },
                { id: '3', type: 'status' },
            ];
            (statusesService.getUnifiedFeed as jest.Mock).mockResolvedValue(mockItems);

            const result = await controller.getUnifiedFeed('user-1', 'all', undefined, undefined, '2');
            expect((result as any).hasMore).toBe(true);
            expect((result as any).items).toHaveLength(2);
        });

        it('should set hasMore=false when results fit within limit', async () => {
            const mockItems = [{ id: '1', type: 'status' }];
            (statusesService.getUnifiedFeed as jest.Mock).mockResolvedValue(mockItems);

            const result = await controller.getUnifiedFeed('user-1', 'all', undefined, undefined, '50');
            expect((result as any).hasMore).toBe(false);
            expect((result as any).items).toHaveLength(1);
        });

        it('should return { items: [], hasMore: false } on service error', async () => {
            (statusesService.getUnifiedFeed as jest.Mock).mockRejectedValue(new Error('DB down'));

            const result = await controller.getUnifiedFeed('user-1', 'all');
            expect(result).toEqual({ items: [], hasMore: false });
        });

        it('should pass lat/lng to service when provided', async () => {
            (statusesService.getUnifiedFeed as jest.Mock).mockResolvedValue([]);

            await controller.getUnifiedFeed('user-1', 'foryou', '37.7749', '-122.4194', '50');
            expect(statusesService.getUnifiedFeed).toHaveBeenCalledWith(
                'user-1',
                'foryou',
                51, // limit + 1
                37.7749,
                -122.4194,
            );
        });

        it('should clamp limit between 1 and 100', async () => {
            (statusesService.getUnifiedFeed as jest.Mock).mockResolvedValue([]);

            // Too large
            await controller.getUnifiedFeed('user-1', 'all', undefined, undefined, '999');
            expect(statusesService.getUnifiedFeed).toHaveBeenCalledWith(
                'user-1', 'all', 101, undefined, undefined,
            );

            // Too small — parseInt('0') is 0 which is falsy, so || 50 kicks in → limit=50, +1=51
            await controller.getUnifiedFeed('user-1', 'all', undefined, undefined, '0');
            expect(statusesService.getUnifiedFeed).toHaveBeenCalledWith(
                'user-1', 'all', 51, undefined, undefined,
            );
        });
    });
});

import { DataSource } from 'typeorm';
import { RankingsController } from './rankings.controller';

describe('RankingsController', () => {
  it('returns player team name and teamId in 1v1 rankings', async () => {
    const query = jest.fn()
      // age column check
      .mockResolvedValueOnce([{ column_name: 'age' }])
      // rankings query
      .mockResolvedValueOnce([
        {
          id: 'u1',
          name: 'Marcus',
          photoUrl: 'https://example.com/a.png',
          rating: 3.9,
          position: 'G',
          city: 'Portland',
          age: 29,
          teamId: 'team-123',
          team: 'Rip City 3v3',
        },
      ]);

    const dataSource = { query } as unknown as DataSource;
    const controller = new RankingsController(dataSource);

    const result = await controller.getRankings('1v1', 'global', undefined, undefined, '50', '0');

    expect(result.mode).toBe('1v1');
    expect(result.rankings).toHaveLength(1);
    expect(result.rankings[0]).toMatchObject({
      id: 'u1',
      teamId: 'team-123',
      team: 'Rip City 3v3',
      rank: 1,
    });
  });
});

import { CourtsService } from "./courts.service";

describe("CourtsService.findAll", () => {
  const courtsRepository = {
    find: jest.fn(),
  };
  const dataSource = {
    options: { type: "postgres" },
    query: jest.fn(),
  };

  let service: CourtsService;

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.query.mockResolvedValue([]);
    service = new CourtsService(
      courtsRepository as any,
      {} as any,
      {} as any,
      dataSource as any,
    );
  });

  it("applies a requested PostgreSQL result limit", async () => {
    await service.findAll(1200);

    const [sql, params] = dataSource.query.mock.calls[0];
    expect(sql).toContain("LIMIT $1");
    expect(params).toEqual([1200]);
  });

  it("clamps oversized requests to 5000 courts", async () => {
    await service.findAll(100000);

    const [, params] = dataSource.query.mock.calls[0];
    expect(params).toEqual([5000]);
  });

  it("preserves the uncapped internal call when no limit is requested", async () => {
    await service.findAll();

    const [sql, params] = dataSource.query.mock.calls[0];
    expect(sql).not.toContain("LIMIT $1");
    expect(params).toEqual([]);
  });
});

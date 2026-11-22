import { getCmsDatabaseAndSecretTokenById } from "@/wab/server/routes/cmse";

const mockListCmsTables = vi.fn(async () => []);
const mockGetCmsDatabaseAndSecretTokenById = vi.fn(async (id: string) => ({
  id,
  name: "Test DB",
  publicToken: "pub",
  secretToken: "sec",
  extraData: { locales: [] },
}));

vi.mock("@/wab/server/routes/util", () => ({
  userDbMgr: () => ({
    getCmsDatabaseAndSecretTokenById: mockGetCmsDatabaseAndSecretTokenById,
    listCmsTables: mockListCmsTables,
  }),
}));

describe("cmse includeArchived parsing", () => {
  beforeEach(() => {
    mockListCmsTables.mockClear();
  });

  it("only includes archived tables when query param is strictly 'true'", async () => {
    for (const [query, expected] of [
      [{}, false],
      [{ includeArchived: "false" }, false],
      [{ includeArchived: "true" }, true],
    ] as const) {
      const json = vi.fn();
      await getCmsDatabaseAndSecretTokenById(
        { params: { dbId: "db1" }, query } as any,
        { json } as any,
      );
      expect(mockListCmsTables).toHaveBeenLastCalledWith("db1", expected);
      expect(json).toHaveBeenCalledTimes(1);
    }
  });
});

import { makeSupabaseFetcher } from "@/wab/server/data-sources/supabase-fetcher";
import { DataSourceError } from "@/wab/shared/data-sources-meta/data-sources";

const mockUpload = vi.fn();
const mockCreateSignedUrl = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: mockUpload,
        createSignedUrl: mockCreateSignedUrl,
      }),
    },
  }),
}));

describe("SupabaseFetcher", () => {
  beforeEach(() => {
    mockUpload.mockReset();
    mockCreateSignedUrl.mockReset();
  });

  const makeFetcher = () =>
    makeSupabaseFetcher({
      source: "supabase",
      settings: { url: "https://example.supabase.co" },
      credentials: { apiKey: "secret" },
    } as any);

  it("returns upload data and throws DataSourceError with statusCode on failure", async () => {
    mockUpload.mockResolvedValueOnce({ data: { path: "a.png" }, error: null });
    await expect(
      makeFetcher().uploadFile({
        bucket: "assets",
        path: "a.png",
        content: btoa("hello"),
        contentType: "image/png",
      }),
    ).resolves.toEqual({ path: "a.png" });

    mockUpload.mockResolvedValueOnce({
      data: null,
      error: { message: "Forbidden", statusCode: 403 },
    });
    await expect(
      makeFetcher().uploadFile({
        bucket: "assets",
        path: "a.png",
        content: btoa("hello"),
        contentType: "image/png",
      }),
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof DataSourceError &&
        err.message === "Forbidden" &&
        err.statusCode === 403,
    );
  });

  it("returns signed URL data and throws DataSourceError with statusCode on failure", async () => {
    mockCreateSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: "https://signed.example.com/a.png" },
      error: null,
    });
    await expect(
      makeFetcher().getSignedFileUrl({
        bucket: "assets",
        path: "a.png",
        expiresIn: 60,
      }),
    ).resolves.toEqual({ signedUrl: "https://signed.example.com/a.png" });

    mockCreateSignedUrl.mockResolvedValueOnce({
      data: null,
      error: { message: "Object not found", statusCode: 404 },
    });
    await expect(
      makeFetcher().getSignedFileUrl({
        bucket: "assets",
        path: "missing.png",
        expiresIn: 60,
      }),
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof DataSourceError &&
        err.message === "Object not found" &&
        err.statusCode === 404,
    );
  });
});

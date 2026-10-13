import http from "node:http";
import { afterEach, expect, it, vi } from "vitest";
import { ensureImageAssetContents } from "./sync-images";

afterEach(() => vi.unstubAllEnvs());

it("downloads self-hosted image bytes rather than decoding the URL as base64", async () => {
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "image/jpeg" });
    res.end(bytes);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as import("node:net").AddressInfo;
    const images = [
      {
        id: "image",
        name: "Image",
        fileName: "image.jpg",
        blob: `http://127.0.0.1:${address.port}/assets/image.jpg`,
      },
    ];
    await ensureImageAssetContents(images);
    expect(Buffer.from(images[0].blob, "base64")).toEqual(bytes);
    const inlined = [{ ...images[0] }];
    await ensureImageAssetContents(inlined);
    expect(inlined).toEqual(images);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

import { Blob as NodeBlob } from "node:buffer";
import { IDBFactory } from "fake-indexeddb";
import { readPreview, writePreview } from "@/wab/client/components/dashboard/preview/cache";
import { ENV } from "@/wab/client/env";
import { previewFormat } from "@/wab/client/components/dashboard/preview/types";

beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("Blob", NodeBlob);
});
afterEach(() => vi.unstubAllGlobals());

it("records the build without partitioning the cache key", async () => {
  await writePreview("user:project", 2, new Blob(["image"]));
  const result = await readPreview("user:project");
  expect(result).toMatchObject({ revision: 2, build: ENV.COMMITHASH, format: previewFormat });
  expect(await result?.blob.text()).toBe("image");
});

it("reads an existing build-specific image and removes it after replacement", async () => {
  await writePreview("user:project:old-build", 1, new Blob(["old"]));
  expect(await (await readPreview("user:project"))?.blob.text()).toBe("old");
  await writePreview("user:project", 1, new Blob(["new"]));
  expect(await (await readPreview("user:project"))?.blob.text()).toBe("new");
  expect(await readPreview("user:project:old-build")).toBeUndefined();
  expect(await readPreview("another-user:project")).toBeUndefined();
});

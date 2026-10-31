import { uploadDataUriToS3 } from "@/wab/server/cdn/images";
import { md5 } from "@/wab/server/util/hash";
import { readFileSync } from "fs";
import path from "path";

const { uploads } = vi.hoisted(() => ({ uploads: [] as any[] }));
vi.mock("@aws-sdk/lib-storage", () => ({
  Upload: class {
    constructor(options: any) {
      uploads.push(options.params);
    }
    async done() {
      return { Location: "https://storage.example/preview.svg" };
    }
  },
}));
vi.mock("@/wab/server/util/s3-util", () => ({ makeS3Client: vi.fn() }));
vi.mock("@/wab/server/observability", () => ({
  logger: () => ({ error: vi.fn() }),
}));

beforeEach(() => {
  uploads.splice(0);
});

const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>预览 100%</text></svg>';

it.each([
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
])("uploads decoded SVG bytes for %s", async (uri) => {
  const result = await uploadDataUriToS3(uri, { imageOnly: true });
  expect(result.isOk()).toBe(true);
  expect(uploads).toHaveLength(1);
  expect(uploads[0].Body.toString()).toBe(svg);
  expect(uploads[0].ContentType).toBe("image/svg+xml");
  expect(uploads[0].Key).toBe(`${md5(Buffer.from(svg))}.svg`);
});

it("accepts every generated Antd6 and Overseas preview through the real image uploader", async () => {
  for (const library of ["antd6", "overseas"]) {
    const previews: Record<string, string> = JSON.parse(
      readFileSync(
        path.resolve(__dirname, "../../../../../../plasmicpkgs", library, "skinny/thumbnails.plasmic.json"),
        "utf8",
      ),
    );
    for (const [name, uri] of Object.entries(previews)) {
      const result = await uploadDataUriToS3(uri, { imageOnly: true });
      expect(result.isOk(), name).toBe(true);
      expect(uploads.at(-1).Body.toString(), name).toContain("<svg");
      expect(uploads.at(-1).ContentType, name).toBe("image/svg+xml");
    }
  }
});

it("continues rejecting non-image data for image-only uploads", async () => {
  const result = await uploadDataUriToS3("data:text/plain,hello%20world", { imageOnly: true });
  expect(result.isErr()).toBe(true);
  expect(uploads).toHaveLength(0);
});

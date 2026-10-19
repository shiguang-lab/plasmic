import { importFigmaFile } from "@/wab/client/figma-importer/import-file";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  convert: vi.fn(),
  pick: vi.fn(),
  uploadImages: vi.fn(),
  uploadVectors: vi.fn(),
  denormalize: vi.fn(),
  insert: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  terminate: vi.fn(),
  release: vi.fn(),
  worker: undefined as any,
  releaseProxy: Symbol("releaseProxy"),
}));
vi.mock("@/wab/client/figma", () => ({
  denormalizeFigmaData: mocks.denormalize,
  insertFigmaData: mocks.insert,
}));
vi.mock("@/wab/client/figma-importer/assets", () => ({
  uploadFigmaImages: mocks.uploadImages,
  uploadNodeImages: mocks.uploadVectors,
}));
vi.mock("@/wab/client/figma-importer/FigmaPagePicker", () => ({
  pickFigmaPage: mocks.pick,
}));
vi.mock("@/wab/client/i18n", () => ({ getUiLocale: () => "en" }));
vi.mock("antd", () => ({
  notification: { error: mocks.error, info: mocks.info },
}));
vi.mock("comlink", () => ({
  wrap: () => ({
    read: mocks.read,
    convert: mocks.convert,
    [mocks.releaseProxy]: mocks.release,
  }),
  transfer: (value: unknown) => value,
  releaseProxy: mocks.releaseProxy,
}));

const ctx = {
  isAtTip: true,
  currentArena: null,
  switchToArena: vi.fn(),
  canEditProject: vi.fn(() => true),
  canEditBranch: vi.fn(() => true),
  app: { withSpinner: <T>(promise: Promise<T>) => promise },
  appCtx: {},
} as unknown as StudioCtx;
const file = () => {
  const value = new File(["fig-kiwi"], "Design.fig");
  Object.defineProperty(value, "arrayBuffer", {
    value: () => Promise.resolve(new ArrayBuffer(12)),
  });
  return value;
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "Worker",
    class {
      onerror?: (event: unknown) => void;
      onmessageerror?: () => void;
      terminate = mocks.terminate;
      constructor() {
        mocks.worker = this;
      }
    },
  );
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  ctx.isAtTip = true;
  vi.mocked(ctx.canEditProject).mockReturnValue(true);
  vi.mocked(ctx.canEditBranch).mockReturnValue(true);
  mocks.read.mockResolvedValue([{ id: "0:1", name: "Desktop" }]);
  mocks.convert.mockResolvedValue({ n: [{}] });
  mocks.denormalize.mockReturnValue({
    nodes: [{ type: "FRAME" }],
    imagesToRename: new Map(),
  });
  mocks.uploadImages.mockResolvedValue(new Map());
  mocks.uploadVectors.mockResolvedValue(new Map());
  mocks.insert.mockResolvedValue({ handled: true, success: true });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("imports a single page without any page or component confirmation", async () => {
  await importFigmaFile(ctx, file());
  expect(mocks.pick).not.toHaveBeenCalled();
  expect(mocks.convert).toHaveBeenCalledWith("0:1");
  expect(mocks.insert).toHaveBeenCalledWith(
    expect.objectContaining({ nodes: [{ type: "FRAME" }] }),
    { studioCtx: ctx },
    false,
    "Desktop",
  );
  expect(mocks.info).toHaveBeenCalledWith({
    message: 'Imported "Desktop" page from Figma',
  });
  expect(mocks.terminate).toHaveBeenCalledOnce();
  expect(mocks.release).toHaveBeenCalledOnce();
});

it("offers pages once and imports only the selected page", async () => {
  const pages = [
    { id: "0:1", name: "中文页面" },
    { id: "0:2", name: "Mobile" },
  ];
  mocks.read.mockResolvedValue(pages);
  mocks.pick.mockResolvedValue("0:2");
  await importFigmaFile(ctx, file());
  expect(mocks.pick).toHaveBeenCalledExactlyOnceWith(pages);
  expect(mocks.convert).toHaveBeenCalledExactlyOnceWith("0:2");
  expect(mocks.insert.mock.calls[0][3]).toBe("Mobile");
});

it("cancels before uploading any resource or changing the Studio model", async () => {
  mocks.read.mockResolvedValue([
    { id: "0:1", name: "One" },
    { id: "0:2", name: "Two" },
  ]);
  mocks.pick.mockResolvedValue(undefined);
  await importFigmaFile(ctx, file());
  expect(mocks.convert).not.toHaveBeenCalled();
  expect(mocks.uploadImages).not.toHaveBeenCalled();
  expect(mocks.uploadVectors).not.toHaveBeenCalled();
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.error).not.toHaveBeenCalled();
  expect(mocks.terminate).toHaveBeenCalledOnce();
});

it.each(["read", "convert", "uploadImages"] as const)(
  "does not write a partial project when %s fails",
  async (step) => {
    mocks[step].mockRejectedValueOnce(new Error("fixture failure"));
    await importFigmaFile(ctx, file());
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledOnce();
    expect(mocks.terminate).toHaveBeenCalledOnce();
    expect(mocks.info).not.toHaveBeenCalled();
  },
);

it("reports a worker startup failure without leaving the loading operation pending", async () => {
  mocks.read.mockImplementationOnce(() => {
    queueMicrotask(() =>
      mocks.worker.onerror({
        message: "Worker could not load",
        preventDefault: vi.fn(),
      }),
    );
    return new Promise(() => undefined);
  });
  await importFigmaFile(ctx, file());
  expect(mocks.error).toHaveBeenCalledOnce();
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.terminate).toHaveBeenCalledOnce();
});

it("reports a synchronous worker construction failure", async () => {
  vi.stubGlobal(
    "Worker",
    class {
      constructor() {
        throw new Error("Worker blocked");
      }
    },
  );
  await importFigmaFile(ctx, file());
  expect(mocks.error).toHaveBeenCalledOnce();
  expect(mocks.insert).not.toHaveBeenCalled();
});

it("rejects empty documents and empty selected pages before uploading", async () => {
  mocks.read.mockResolvedValueOnce([]);
  await importFigmaFile(ctx, file());
  expect(mocks.error).toHaveBeenLastCalledWith(
    expect.objectContaining({
      description: "The Figma file has no visible pages.",
    }),
  );
  mocks.denormalize.mockReturnValueOnce({
    nodes: [],
    imagesToRename: new Map(),
  });
  await importFigmaFile(ctx, file());
  expect(mocks.error).toHaveBeenLastCalledWith(
    expect.objectContaining({
      description: "The selected Figma page has no supported layers.",
    }),
  );
  expect(mocks.uploadImages).not.toHaveBeenCalled();
  expect(mocks.insert).not.toHaveBeenCalled();
});

it("does not import into a read-only or protected project", async () => {
  vi.mocked(ctx.canEditProject).mockReturnValueOnce(false);
  await importFigmaFile(ctx, file());
  vi.mocked(ctx.canEditBranch).mockReturnValueOnce(false);
  await importFigmaFile(ctx, file());
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.insert).not.toHaveBeenCalled();
});

it("does not import into a historical revision", async () => {
  ctx.isAtTip = false;
  await importFigmaFile(ctx, file());
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.insert).not.toHaveBeenCalled();
});

it("restores canvas navigation when insertion rolls back", async () => {
  mocks.insert.mockImplementationOnce(async () => {
    Object.defineProperty(ctx, "currentArena", {
      value: {},
      configurable: true,
    });
    throw new Error("Could not convert layer");
  });
  const previous = ctx.currentArena;
  await importFigmaFile(ctx, file());
  expect(ctx.switchToArena).toHaveBeenCalledWith(previous);
  expect(mocks.error).toHaveBeenCalledOnce();
  expect(mocks.info).not.toHaveBeenCalled();
  Object.defineProperty(ctx, "currentArena", {
    value: null,
    configurable: true,
  });
});

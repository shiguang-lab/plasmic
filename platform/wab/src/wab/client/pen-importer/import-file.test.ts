import { importPenFile } from "@/wab/client/pen-importer/import-file";
import { setLanguagePreference } from "@/wab/client/i18n";
import { languageOptions, translate } from "@/wab/client/i18n/locales";
import { act, cleanup, render } from "@testing-library/react";
import { createElement, Fragment } from "react";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";

const mocks = vi.hoisted(() => ({
  files: vi.fn(),
  pick: vi.fn(),
  read: vi.fn(),
  frames: vi.fn(),
  convert: vi.fn(),
  uploads: vi.fn(),
  insert: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  success: vi.fn(),
  release: vi.fn(),
  terminate: vi.fn(),
  worker: undefined as any,
  releaseProxy: Symbol("release"),
}));
vi.mock("@/wab/client/pen-importer/PenImportPicker", () => ({
  pickPenFiles: mocks.files,
  pickPenChoice: mocks.pick,
}));
vi.mock("@/wab/client/pen-importer/insert", () => ({
  uploadPenAssets: mocks.uploads,
  insertPenDesign: mocks.insert,
}));
vi.mock("antd", () => ({
  notification: { error: mocks.error, warning: mocks.warning },
  message: { success: mocks.success },
}));
vi.mock("comlink", () => ({
  wrap: () => ({
    read: mocks.read,
    frames: mocks.frames,
    convert: mocks.convert,
    [mocks.releaseProxy]: mocks.release,
  }),
  transfer: (value: unknown) => value,
  releaseProxy: mocks.releaseProxy,
}));
const ctx = {
  isAtTip: true,
  canEditProject: () => true,
  canEditBranch: () => true,
  app: { withSpinner: <T>(promise: Promise<T>) => promise },
} as unknown as StudioCtx;
const design = { root: {}, width: 800, height: 600, assets: [], warnings: [] };
beforeEach(async () => {
  await setLanguagePreference("en");
  vi.clearAllMocks();
  ctx.isAtTip = true;
  const file = new File(["{}"], "design.pen");
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new ArrayBuffer(2),
  });
  Object.defineProperty(file, "webkitRelativePath", {
    value: "bundle/design.pen",
  });
  mocks.files.mockResolvedValue([file]);
  mocks.read.mockResolvedValue([
    { id: "bundle/design.pen", name: "design.pen" },
  ]);
  mocks.frames.mockResolvedValue([{ id: "root", name: "业务设计" }]);
  mocks.convert.mockResolvedValue(design);
  mocks.uploads.mockResolvedValue(new Map());
  mocks.insert.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
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
});
afterEach(async () => {
  cleanup();
  await setLanguagePreference("en");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("localizes an open import error in every language and keeps raw diagnostics in the console", async () => {
  const error = new Error("fixture failure from worker");
  mocks.read.mockRejectedValueOnce(error);
  await importPenFile(ctx);
  const notice = mocks.error.mock.calls[0][0];
  const view = render(createElement(Fragment, null, notice.message, notice.description));
  for (const { value } of languageOptions) {
    await act(async () => await setLanguagePreference(value));
    expect(view.container.textContent).toBe(
      translate(value, "Could not import Pen file") +
      translate(value, "Check the file and include its libraries, images and scripts in the selected folder or ZIP."),
    );
    expect(view.container.textContent).not.toContain(error.message);
  }
  expect(console.error).toHaveBeenCalledWith("Pen import failed", error);
});

it("imports the selected folder-relative file into an independent canvas", async () => {
  await importPenFile(ctx);
  expect(mocks.read).toHaveBeenCalledWith([
    expect.objectContaining({ path: "bundle/design.pen" }),
  ]);
  expect(mocks.convert).toHaveBeenCalledWith("bundle/design.pen", "root");
  expect(mocks.insert).toHaveBeenCalledWith(ctx, design, new Map(), "业务设计");
  expect(mocks.success).toHaveBeenCalledWith(
    'Imported "业务设计" canvas from Pen',
  );
  expect(mocks.release).toHaveBeenCalledOnce();
  expect(mocks.terminate).toHaveBeenCalledOnce();
});

it("cancels the chooser without starting a worker", async () => {
  mocks.files.mockResolvedValue(undefined);
  await importPenFile(ctx);
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.insert).not.toHaveBeenCalled();
});

it("cancels canvas selection before uploading assets or mutating the project", async () => {
  mocks.frames.mockResolvedValue([
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ]);
  mocks.pick.mockResolvedValue(undefined);
  await importPenFile(ctx);
  expect(mocks.convert).not.toHaveBeenCalled();
  expect(mocks.uploads).not.toHaveBeenCalled();
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.terminate).toHaveBeenCalledOnce();
});

it.each(["read", "convert", "uploads"] as const)(
  "does not insert a partial design when %s fails",
  async (step) => {
    mocks[step].mockRejectedValueOnce(new Error("fixture failure"));
    await importPenFile(ctx);
    expect(mocks.error).toHaveBeenCalledOnce();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.terminate).toHaveBeenCalledOnce();
  },
);

it("stops before insertion when edit permission is lost during preparation", async () => {
  mocks.uploads.mockImplementationOnce(async () => {
    ctx.isAtTip = false;
    return new Map();
  });
  await importPenFile(ctx);
  expect(mocks.insert).not.toHaveBeenCalled();
});

it("handles worker startup errors and releases its resources", async () => {
  mocks.read.mockImplementationOnce(() => {
    queueMicrotask(() =>
        mocks.worker.onerror({ message: "Worker failed", preventDefault: vi.fn() }),
    );
    return new Promise(() => undefined);
  });
  await importPenFile(ctx);
  expect(mocks.error).toHaveBeenCalledOnce();
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.terminate).toHaveBeenCalledOnce();
});

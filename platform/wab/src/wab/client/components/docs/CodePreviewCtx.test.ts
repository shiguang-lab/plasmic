import { CodePreviewCtx } from "@/wab/client/components/docs/CodePreviewCtx";
import { formatDocsCode } from "@/wab/client/components/docs/serialize-docs-preview";

vi.mock("@/wab/client/components/docs/serialize-docs-preview", () => ({
  formatDocsCode: vi.fn(),
}));

beforeEach(() => vi.mocked(formatDocsCode).mockReset());

it("does not publish equal edits and keeps examples isolated", () => {
  const first = new CodePreviewCtx("initial");
  const second = new CodePreviewCtx("other");
  const changed = vi.fn();
  const unrelated = vi.fn();
  first.store.subscribe(changed);
  second.store.subscribe(unrelated);
  first.setCode("edited");
  for (let i = 0; i < 100; i++) {first.setCode("edited");}
  expect(changed).toHaveBeenCalledOnce();
  expect(unrelated).not.toHaveBeenCalled();
  expect(first.store.getInitialState()).toBe("initial");
  expect(second.getCode()).toBe("other");
});

it("starts formatting after mount and cancels StrictMode's first setup", async () => {
  const ctx = new CodePreviewCtx("<Button   />");
  expect(formatDocsCode).not.toHaveBeenCalled();
  vi.mocked(formatDocsCode).mockResolvedValue("<Button />");
  const cancel = ctx.formatInitialCode();
  cancel();
  const cleanup = ctx.formatInitialCode();
  await vi.waitFor(() => expect(ctx.getCode()).toBe("<Button />"));
  expect(formatDocsCode).toHaveBeenCalledExactlyOnceWith("<Button   />");
  cleanup();
});

it("skips formatting when an edit arrives before the deferred work", async () => {
  const ctx = new CodePreviewCtx("initial");
  const cancel = ctx.formatInitialCode();
  ctx.setCode("typed");
  await Promise.resolve();
  expect(formatDocsCode).not.toHaveBeenCalled();
  expect(ctx.getCode()).toBe("typed");
  cancel();
});

it.each(["edit", "unmount"] as const)(
  "does not publish stale formatting after %s",
  async (action) => {
    const result = Promise.withResolvers<string>();
    vi.mocked(formatDocsCode).mockReturnValue(result.promise);
    const ctx = new CodePreviewCtx("initial");
    const changed = vi.fn();
    ctx.store.subscribe(changed);
    const cancel = ctx.formatInitialCode();
    await Promise.resolve();
    expect(formatDocsCode).toHaveBeenCalledOnce();
    if (action === "edit") {ctx.setCode("typed");}
    else {cancel();}
    changed.mockClear();
    result.resolve("formatted");
    await result.promise;
    expect(changed).not.toHaveBeenCalled();
    expect(ctx.getCode()).toBe(action === "edit" ? "typed" : "initial");
    cancel();
  },
);

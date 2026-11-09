import { useCodegenType } from "@/wab/client/hooks/useCodegenType";
import { codegenTypeKey } from "@/wab/client/LocalStorageKey";
import { act, renderHook } from "@testing-library/react";

const context = vi.hoisted(() => ({ api: undefined as any }));
vi.mock("@/wab/client/contexts/AppContexts", () => ({ useAppCtx: () => context }));
vi.mock("comlink", () => ({ proxy: (callback: unknown) => callback }));

it("transfers storage listeners and ignores old reads and queued notifications", async () => {
  function makeApi() {
    let resolve: (value: string) => void = () => {};
    const read = new Promise<string>((done) => { resolve = done; });
    return { getStorageItem: vi.fn(() => read), addStorageListener: vi.fn(), removeEventListener: vi.fn(), resolve };
  }
  const first = makeApi(), second = makeApi();
  context.api = first;
  const view = renderHook(useCodegenType);
  const [firstId, oldListener] = first.addStorageListener.mock.calls[0] as unknown as [string, (event: any) => void];
  context.api = second;
  view.rerender();
  expect(first.removeEventListener).toHaveBeenCalledWith("storage", firstId);
  await act(async () => second.resolve("loader"));
  expect(view.result.current).toBe("loader");
  await act(async () => first.resolve("codegen"));
  act(() => oldListener({ key: codegenTypeKey, newValue: "codegen" }));
  expect(view.result.current).toBe("loader");
  const [secondId, listener] = second.addStorageListener.mock.calls[0] as unknown as [string, (event: any) => void];
  act(() => listener({ key: codegenTypeKey, newValue: "codegen" }));
  expect(view.result.current).toBe("codegen");
  view.unmount();
  expect(second.removeEventListener).toHaveBeenCalledWith("storage", secondId);
});

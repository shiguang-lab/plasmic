import { makeMonacoAutoFocus } from "@/wab/client/components/coding/monacoEditorUtil";

vi.mock("@/wab/client/monaco-worker-url", () => ({
  configureMonacoWorkers: vi.fn(),
}));

vi.mock("monaco-editor", () => ({
  KeyMod: { Alt: 1, CtrlCmd: 2, Shift: 4, WinCtrl: 8 },
  typescript: {
    ModuleResolutionKind: { NodeJs: 2 },
    ScriptTarget: { ESNext: 99 },
    javascriptDefaults: { setCompilerOptions: vi.fn() },
    typescriptDefaults: { setCompilerOptions: vi.fn() },
  },
}));

describe("makeMonacoAutoFocus", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("restores ancestor and window scroll positions when focusing shifts scroll", () => {
    const outer = document.createElement("div");
    const inner = document.createElement("div");
    const editorDom = document.createElement("div");
    outer.appendChild(inner);
    inner.appendChild(editorDom);
    document.body.appendChild(outer);

    outer.scrollTop = 0;
    inner.scrollTop = 24;
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });

    let onScrollCallback: (() => void) | undefined;
    const dispose = vi.fn();
    const focus = vi.fn(() => {
      // Simulate Chromium scroll-into-view pushing outer ancestors up during focus().
      outer.scrollTop = 96;
      inner.scrollTop = 140;
      Object.defineProperty(window, "scrollY", { value: 84, configurable: true });
    });

    makeMonacoAutoFocus({
      getDomNode: () => editorDom,
      focus,
      onDidScrollChange: (cb: () => void) => {
        onScrollCallback = cb;
        return { dispose };
      },
    } as any);

    expect(focus).toHaveBeenCalledTimes(1);
    expect(outer.scrollTop).toBe(0);
    expect(inner.scrollTop).toBe(24);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);

    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    onScrollCallback?.();
    expect(dispose).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledTimes(2);
    expect(outer.scrollTop).toBe(0);
    expect(inner.scrollTop).toBe(24);
  });

  it("skips focusing when the editor DOM node is already detached", () => {
    const detached = document.createElement("div");
    const focus = vi.fn();
    makeMonacoAutoFocus({
      getDomNode: () => detached,
      focus,
      onDidScrollChange: () => ({ dispose: vi.fn() }),
    } as any);
    expect(focus).not.toHaveBeenCalled();
  });
});

import { getHostWindow, getTopFrameWindow, isBuiltinStudioDocument } from "@/wab/client/frame-ctx/host-window";

afterEach(() => {
  document.documentElement.removeAttribute("data-plasmic-host");
  vi.unstubAllGlobals();
});

it("keeps the custom Host as runtime owner and resolves its parent as TopFrame", () => {
  const top = {};
  const host = { parent: top };
  vi.stubGlobal("window", { parent: host });
  expect(isBuiltinStudioDocument()).toBe(false);
  expect(getHostWindow()).toBe(host);
  expect(getTopFrameWindow()).toBe(top);
});

it("uses the built-in editor's own runtime without reaching across the TopFrame origin", () => {
  const top = {};
  const editor = { parent: top };
  document.documentElement.setAttribute("data-plasmic-host", "self");
  vi.stubGlobal("window", editor);
  expect(isBuiltinStudioDocument()).toBe(true);
  expect(getHostWindow()).toBe(editor);
  expect(getTopFrameWindow()).toBe(top);
});

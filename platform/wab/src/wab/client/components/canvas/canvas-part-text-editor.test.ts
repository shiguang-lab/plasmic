import { createCanvasPartTextEditor } from "@/wab/client/components/canvas/canvas-part-text-editor";

afterEach(() => { document.body.innerHTML = ""; });

function fixture(value = "取消") {
  const button = document.body.appendChild(document.createElement("button"));
  button.innerHTML = '<span class="icon">icon</span><span class="label">取 消</span>';
  const label = button.querySelector<HTMLElement>(".label")!;
  const labelNode = label.firstChild;
  const commit = vi.fn();
  const done = vi.fn();
  const bounds = vi.fn();
  const part = { element: button, displayName: "Cancel button", text: { prop: "cancelText", selector: ".label" } };
  const editor = createCanvasPartTextEditor(part, value, commit, done, bounds)!;
  return { ...editor, commit, done, bounds, label, labelNode, button };
}

it("edits the raw prop while preserving the component's label nodes and icons", () => {
  const f = fixture();
  expect(f.input.value).toBe("取消");
  expect(f.label.style.visibility).toBe("hidden");
  f.input.value = "返回";
  f.input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  expect(f.commit).toHaveBeenCalledExactlyOnceWith("返回");
  expect(f.done).toHaveBeenCalledOnce();
  expect(f.label.firstChild).toBe(f.labelNode);
  expect(f.label.textContent).toBe("取 消");
  expect(f.label.style.visibility).toBe("");
  expect(f.button.querySelector(".icon")?.textContent).toBe("icon");
  expect(f.input.isConnected).toBe(false);
  f.finish();
  expect(f.commit).toHaveBeenCalledOnce();
});

it("cancels with Escape and does not commit an unchanged label", () => {
  const f = fixture();
  f.input.value = "临时文案";
  f.input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  f.finish();
  expect(f.commit).not.toHaveBeenCalled();
  const unchanged = fixture();
  unchanged.finish();
  expect(unchanged.commit).not.toHaveBeenCalled();
});

it("commits on blur or Tab but keeps IME Enter inside the draft", () => {
  const f = fixture();
  f.input.value = "返回";
  f.input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true }));
  expect(f.input.isConnected).toBe(true);
  expect(f.commit).not.toHaveBeenCalled();
  f.input.dispatchEvent(new FocusEvent("blur"));
  expect(f.commit).toHaveBeenCalledExactlyOnceWith("返回");
  const tab = fixture();
  tab.input.value = "关闭";
  tab.input.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
  expect(tab.commit).toHaveBeenCalledExactlyOnceWith("关闭");
});

it("does not create an editor for missing or detached label DOM", () => {
  const part = { element: document.createElement("button"), displayName: "Button", text: { prop: "label", selector: "span" } };
  expect(createCanvasPartTextEditor(part, "label", vi.fn(), vi.fn(), vi.fn())).toBeUndefined();
});

it("can edit an empty native button whose label span is absent", () => {
  const button = document.body.appendChild(document.createElement("button"));
  const commit = vi.fn();
  const editor = createCanvasPartTextEditor({ element: button, displayName: "Confirm button", text: { prop: "okText", selector: "span" } }, "", commit, vi.fn(), vi.fn())!;
  expect(button.style.visibility).toBe("");
  editor.input.value = "保存";
  editor.finish();
  expect(commit).toHaveBeenCalledExactlyOnceWith("保存");
});

it("previews growth and shrinkage before commit, follows the label, and restores its nodes on Escape", () => {
  const f = fixture();
  vi.spyOn(f.label, "getBoundingClientRect").mockImplementation(() => {
    const width = (f.label.textContent?.length ?? 0) * 10;
    return new DOMRect(300 - width, 100, width, 22);
  });
  for (const text of ["取消122221", "返回"] ) {
    f.input.value = text;
    f.input.dispatchEvent(new Event("input"));
    expect(f.label.textContent).toBe(text);
    expect(f.label.firstChild).toBe(f.labelNode);
    expect(f.input.style.width).toBe(`${text.length * 10}px`);
    expect(f.input.style.left).toBe(`${300 - text.length * 10}px`);
    expect(f.bounds).toHaveBeenCalledTimes(text === "返回" ? 3 : 2);
    expect(f.commit).not.toHaveBeenCalled();
    expect(f.button.style.width).toBe("");
  }
  f.finish(true);
  expect(f.label.textContent).toBe("取 消");
  expect(f.label.firstChild).toBe(f.labelNode);
  expect(f.commit).not.toHaveBeenCalled();
});

it("restores the native text before committing once and removes an empty-label draft on cancel", () => {
  const f = fixture();
  f.input.value = "继续配置";
  f.input.dispatchEvent(new Event("input"));
  f.commit.mockImplementation(() => expect(f.label.textContent).toBe("取 消"));
  f.finish();
  expect(f.commit).toHaveBeenCalledExactlyOnceWith("继续配置");
  const button = document.body.appendChild(document.createElement("button"));
  const empty = createCanvasPartTextEditor({ element: button, displayName: "Confirm button", text: { prop: "okText", selector: "span" } }, "", vi.fn(), vi.fn(), vi.fn())!;
  empty.input.value = "保存";
  empty.input.dispatchEvent(new Event("input"));
  expect(button.textContent).toBe("保存");
  empty.finish(true);
  expect(button.childNodes).toHaveLength(0);
});

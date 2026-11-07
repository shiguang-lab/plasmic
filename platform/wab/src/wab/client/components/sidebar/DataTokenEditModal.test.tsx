import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { DataTokenEditModal } from "@/wab/client/components/sidebar/DataTokenEditModal";
import type { CodeEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/CodeEditor";
import { mkDataToken } from "@/wab/commons/DataToken";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const modalRender = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/components/sidebar/SidebarModal", () => ({
  SidebarModal: ({ title, children }: React.PropsWithChildren<{ title: React.ReactNode }>) => { modalRender(); return <div>{title}{children}</div>; },
}));
vi.mock("@/wab/client/components/sidebar-tabs/ComponentProps/CodeEditor", () => ({
  CodeEditor: ({ title, value, onChange, fileName }: React.ComponentProps<typeof CodeEditor>) => <div><textarea aria-label={title} value={String(value)} onChange={(event) => onChange(event.target.value)} /><output aria-label="Editor file">{fileName}</output></div>,
}));
class VisibleIntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly scrollMargin = "0px";
  readonly thresholds = [0];
  readonly delay = 0;
  readonly trackVisibility = false;
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    const entry = mock<IntersectionObserverEntry>({ isIntersecting: true });
    Object.defineProperty(entry, "target", { value: target });
    this.callback([entry], this);
  }
  disconnect() { return undefined; }
  unobserve() { return undefined; }
  takeRecords(): IntersectionObserverEntry[] { return []; }
}
beforeEach(() => vi.stubGlobal("IntersectionObserver", VisibleIntersectionObserver));
afterEach(() => { cleanup(); modalRender.mockClear(); vi.unstubAllGlobals(); });

it("subscribes to model name while preserving a local value draft and the actual save/rename commands", async () => {
  const { studioCtx } = fakeStudioCtx();
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  const token = mkDataToken({ name: "Original", value: '"Before"' });
  await studioCtx.changeUnsafe(() => { studioCtx.site.dataTokens.push(token); });
  const view = render(<DataTokenEditModal studioCtx={studioCtx} token={token} onClose={vi.fn()} />);
  try {
    const valueInput = screen.getByPlaceholderText("Enter text here...");
    fireEvent.change(valueInput, { target: { value: "Draft" } });
    expect(valueInput).toHaveProperty("value", "Draft");
    const renders = modalRender.mock.calls.length;
    await act(async () => { await studioCtx.changeUnsafe(() => { token.value = '"External"'; }); });
    expect(modalRender).toHaveBeenCalledTimes(renders);
    expect(valueInput).toHaveProperty("value", "Draft");
    await act(async () => { await studioCtx.changeUnsafe(() => { token.name = "External name"; }); });
    const nameInput = screen.getByPlaceholderText("(unnamed token)");
    expect(nameInput).toHaveProperty("value", "External name");
    fireEvent.blur(valueInput);
    await waitFor(() => expect(token.value).toBe('"Draft"'));
    fireEvent.change(nameInput, { target: { value: "User name" } });
    fireEvent.blur(nameInput);
    await waitFor(() => expect(token.name).toBe("User name"));
    expect(nameInput).toHaveProperty("value", "User name");
  } finally { view.unmount(); studioCtx.dispose(); }
});

it("switches code editor ownership to a constructed token and saves its code expression", async () => {
  const { studioCtx } = fakeStudioCtx();
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  const token = mkDataToken({ name: "Expression", value: "1 + 2" });
  await studioCtx.changeUnsafe(() => { studioCtx.site.dataTokens.push(token); });
  const view = render(<DataTokenEditModal studioCtx={studioCtx} token={token} onClose={vi.fn()} />);
  try {
    expect(screen.getByRole("textbox", { name: "Expression" })).toHaveProperty("value", "1 + 2");
    const replacement = mkDataToken({ name: "New expression", value: "1 + 2", uuid: "new-expression" });
    await act(async () => { await studioCtx.changeUnsafe(() => { studioCtx.site.dataTokens.push(replacement); }); });
    view.rerender(<DataTokenEditModal key={replacement.uuid} studioCtx={studioCtx} token={replacement} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Editor file").textContent).toBe("data-token-new-expression-code");
    fireEvent.change(screen.getByRole("textbox", { name: "New expression" }), { target: { value: "4 + 5" } });
    await waitFor(() => expect(replacement.value).toBe("(4 + 5)"));
    expect(token.value).toBe("1 + 2");
  } finally { view.unmount(); studioCtx.dispose(); }
});

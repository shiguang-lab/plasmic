import { SpacingControl } from "@/wab/client/components/style-controls/SpacingControl";
import { act, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

const fixture = vi.hoisted(() => {
  let values: Readonly<Record<string, string>> = {};
  let lifetime = new AbortController();
  const listeners = new Set<() => void>();
  const publish = (next: Record<string, string>) => { values = Object.freeze(next); listeners.forEach((listener) => listener()); };
  return {
    read: () => values,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    write: (key: string, value: string) => publish({ ...values, [key]: value }),
    clear: (key: string) => { const next = { ...values }; delete next[key]; publish(next); },
    signal: () => lifetime.signal,
    abort: () => lifetime.abort(),
    reset: () => { lifetime = new AbortController(); publish({ "padding-top": "10px", "padding-right": "20px", "padding-bottom": "30px", "padding-left": "40px" }); },
    app: { setIsDragging: vi.fn() },
    start: vi.fn(), stop: vi.fn(),
  };
});

// The interaction test keeps the real spacing and native drag fibers while
// substituting the surrounding panel widgets and model transaction boundary.
vi.mock("@/wab/client/components/top-view", () => ({ useApp: () => fixture.app }));
vi.mock("@/wab/client/components/sidebar/sidebar-helpers", () => ({
  LabeledStyleDimItem: ({ label, dimOpts }: { label: string; dimOpts: { ref: React.Ref<HTMLInputElement>; value: string; onChange: (value: string) => void; onFocus: () => void; onBlur: () => void } }) =>
    <label data-plasmic-role="labeled-item">{label}<input aria-label={label} ref={dimOpts.ref} value={dimOpts.value} onChange={(event) => dimOpts.onChange(event.target.value)} onFocus={dimOpts.onFocus} onBlur={dimOpts.onBlur} /></label>,
}));
vi.mock("@/wab/client/components/style-controls/StyleComponent", () => ({
  getLabelForStyleName: (name: string) => name,
  createStyleContextMenu: vi.fn(),
  changeStyle: (provider: { studioCtx: { changeSpawn: (command: () => void) => void } }, command: () => void) => provider.studioCtx.changeSpawn(command),
}));
vi.mock("@/wab/client/components/style-controls/UnloggedDragCatcher", () => ({ UnloggedDragCatcher: ({ children }: React.PropsWithChildren) => children }));
vi.mock("@/wab/client/components/ContextMenu", () => ({ maybeShowContextMenu: vi.fn() }));
vi.mock("@/wab/client/studio-ctx/style-inputs-react", () => ({
  useStyleCells: (_provider: unknown, keys: string[]) => {
    const values = React.useSyncExternalStore(fixture.subscribe, fixture.read, fixture.read);
    return keys.map((key) => ({ key, value: values[key] ?? "0px" }));
  },
  useStyleIndicators: (_provider: unknown, keys: string[]) => keys.map(() => ({ source: "set" })),
}));
vi.mock("@/wab/client/studio-ctx/varianted-style-context", () => ({ useVariantedStylesHelperFromCurrentCtx: () => undefined }));
vi.mock("@/wab/client/studio-ctx/style-token-ref-inputs", () => ({
  useStyleTokenRefs: (_studio: unknown, inputs: string[], _helper: unknown, _role: string, select: (value: { rows: { input: string; resolved: { value: string } }[] }) => unknown) => ({ selected: select({ rows: inputs.map((input) => ({ input, resolved: { value: input } })) }) }),
}));
vi.mock("antd", () => ({
  Popover: ({ open, content, children }: { open: boolean; content: React.ReactNode; children: React.ReactNode }) => <>{children}{open && content}</>,
  Tooltip: ({ children }: React.PropsWithChildren) => children,
}));

function provider(): React.ComponentProps<typeof SpacingControl>["expsProvider"] {
  const exp = { set: fixture.write, clear: fixture.clear };
  return {
    studioCtx: { arenaState: { lifetime: fixture.signal }, startUnlogged: fixture.start, stopUnlogged: fixture.stop, changeSpawn: (command: () => void) => { if (!fixture.signal().aborted) { command(); } } },
    mergedExp: () => exp,
    getNativeStyleSource: () => ({ inputs: { isDisposed: fixture.signal().aborted } }),
  } as unknown as React.ComponentProps<typeof SpacingControl>["expsProvider"];
}

beforeEach(() => { fixture.reset(); vi.clearAllMocks(); });

it("keeps a stable command handle and targets the selected side through edits and clear", () => {
  const ref = React.createRef<React.ComponentRef<typeof SpacingControl>>();
  const mounted = render(<React.StrictMode><SpacingControl ref={ref} expsProvider={provider()} spacingStyleProp="padding" /></React.StrictMode>);
  const input = screen.getByRole("textbox", { name: "padding" });
  fireEvent.focus(input);
  const handle = ref.current;
  const top = mounted.container.querySelector(".spacing-control__handle.ns-resize");
  expect(top).not.toBeNull();
  fireEvent.click(top as Element, { detail: 1 });
  act(() => handle?.setAllSelected("31px"));
  expect(fixture.read()).toMatchObject({ "padding-top": "31px", "padding-right": "20px", "padding-bottom": "30px" });
  expect(ref.current).toBe(handle);
  act(() => handle?.clearAllSelected());
  expect(fixture.read()["padding-top"]).toBeUndefined();
  act(() => fixture.abort());
  expect(ref.current).toBeNull();
  act(() => handle?.setAllSelected("99px"));
  expect(fixture.read()["padding-top"]).toBeUndefined();
  mounted.unmount();
});

it("uses the native SVG drag target and closes the unlogged drag", () => {
  const mounted = render(<SpacingControl expsProvider={provider()} spacingStyleProp="padding" />);
  fireEvent.focus(screen.getByRole("textbox", { name: "padding" }));
  const top = mounted.container.querySelector(".spacing-control__handle.ns-resize");
  expect(top).not.toBeNull();
  fireEvent.mouseDown(top as Element, { button: 0, clientX: 0, clientY: 0 });
  fireEvent.mouseMove(document, { buttons: 1, clientX: 0, clientY: 5 });
  fireEvent.mouseMove(document, { buttons: 1, clientX: 0, clientY: 10 });
  fireEvent.mouseUp(document, { button: 0, clientX: 0, clientY: 10 });
  expect(fixture.read()["padding-top"]).toBe("20px");
  expect(fixture.read()["padding-bottom"]).toBe("30px");
  expect(fixture.start).toHaveBeenCalledOnce();
  expect(fixture.stop).toHaveBeenCalledOnce();
  expect(fixture.app.setIsDragging.mock.calls).toEqual([[true], [false]]);
  mounted.unmount();
});

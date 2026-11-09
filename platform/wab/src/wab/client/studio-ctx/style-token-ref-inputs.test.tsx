import { AppContext } from "@/wab/client/components/top-view";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { useShallow } from "zustand/react/shallow";
import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import { ColorButton } from "@/wab/client/components/style-controls/ColorButton";
import { ColorStops } from "@/wab/client/components/style-controls/ColorStops";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { StyleTokenRefInputs, useStyleTokenRefs } from "@/wab/client/studio-ctx/style-token-ref-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkStyleToken, mkTokenRef, resolveToken } from "@/wab/commons/StyleToken";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { ensure } from "@/wab/shared/common";
import { Dim, Stop } from "@/wab/shared/core/bg-styles";
import { createSite } from "@/wab/shared/core/sites";
import { siteFinalStyleTokensAllDeps } from "@/wab/shared/core/site-style-tokens";
import { OverrideableToken, toFinalToken } from "@/wab/shared/core/tokens";
import { ProjectDependency, StyleToken, VariantedValue, type Variant, type ObjInst } from "@/wab/shared/model/classes";
import { TplMgr } from "@/wab/shared/TplMgr";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { mock } from "vitest-mock-extended";

class VisibleIntersectionObserver {
  readonly root = null; readonly rootMargin = "0px"; readonly scrollMargin = "0px"; readonly thresholds = [0]; readonly delay = 0; readonly trackVisibility = false;
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) { const entry = mock<IntersectionObserverEntry>({ isIntersecting: true }); Object.defineProperty(entry, "target", { value: target }); this.callback([entry], this); }
  disconnect() { return undefined; } unobserve() { return undefined; } takeRecords(): IntersectionObserverEntry[] { return []; }
}
beforeEach(() => vi.stubGlobal("IntersectionObserver", VisibleIntersectionObserver));
const studios = new Set<StudioCtx>();
const extras = new Set<HTMLElement>();
afterEach(async () => { cleanup(); extras.forEach((element) => element.remove()); extras.clear(); document.documentElement.style.removeProperty("--reference-color"); document.documentElement.style.removeProperty("--fresh-gradient"); for (const studio of studios) { await studio.awaitEval(); studio.dispose(); } studios.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function setup(registered = false) {
  const site = createSite();
  const end = registered
    ? new StyleToken({ uuid: "registered-reference-end", name: "End", type: "Color", value: "var(--reference-color)", variantedValues: [], isRegistered: true, regKey: "registered-color" })
    : mkStyleToken({ name: "End", type: "Color", value: "#123456" });
  const middle = mkStyleToken({ name: "Middle", type: "Color", value: mkTokenRef(end) });
  const head = mkStyleToken({ name: "Head", type: "Color", value: mkTokenRef(middle) });
  const other = mkStyleToken({ name: "Other", type: "Color", value: "#00FF00" });
  site.styleTokens.push(head, middle, end, other);
  const f = fakeStudioCtx({ site }); studios.add(f.studioCtx);
  await waitFor(() => expect(f.studioCtx.initialRouteReady).toBe(true));
  return { ...f, studio: f.studioCtx, site, head, middle, end, other, helper: new VariantedStylesHelper(site) };
}
function wrap(f: Awaited<ReturnType<typeof setup>>, children: React.ReactNode) {
  return <AppContext.Provider value={f.studio.app}><StudioCtxContext.Provider value={f.studio}><div className="app-container"><SidebarModalProvider>{children}</SidebarModalProvider></div></StudioCtxContext.Provider></AppContext.Provider>;
}

it("leases only actual resolver nodes and presents the final chain result to the first public field subscriber", async () => {
  const f = await setup(), source = new StyleTokenRefInputs(f.studio, [mkTokenRef(f.head)], f.helper, "Color");
  source.getSnapshot();
  const first = vi.fn(() => expect(source.getSnapshot().rows[0]?.resolved?.value).toBe("#ABCDEF"));
  const stopFirst = f.studio.modelSnapshots.field(f.end, "value").subscribe(first);
  const stop = source.subscribe(() => undefined);
  await f.studio.changeUnsafe(() => { f.middle.value = mkTokenRef(f.end); f.end.value = "#ABCDEF"; });
  expect(first).toHaveBeenCalledOnce();
  expect(source.getSnapshot().rows[0]?.applied?.name).toBe("Head");
  const current = source.getSnapshot(), changed = vi.fn(), stopChanges = source.subscribe(changed);
  await f.studio.changeUnsafe(() => { f.other.value = "#AA0000"; });
  expect(source.getSnapshot()).toBe(current); expect(changed).not.toHaveBeenCalled();
  stopChanges(); stop(); stopFirst();
});

it("rewires reference edits and releases the no-longer-selected alias path", async () => {
  const f = await setup(), source = new StyleTokenRefInputs(f.studio, [mkTokenRef(f.head)], f.helper, "Color"), stop = source.subscribe(() => undefined);
  await f.studio.changeUnsafe(() => { f.middle.value = mkTokenRef(f.other); });
  expect(source.getSnapshot().rows[0]?.resolved?.value).toBe("#00FF00");
  const snapshot = source.getSnapshot(), changed = vi.fn(), stopChanges = source.subscribe(changed);
  await f.studio.changeUnsafe(() => { f.end.value = "#FF0000"; });
  expect(source.getSnapshot()).toBe(snapshot); expect(changed).not.toHaveBeenCalled(); stopChanges(); stop();
});

it("resolves a direct-dependency alias through actual root override commands", async () => {
  const f = await setup(), dependencySite = createSite(), imported = mkStyleToken({ name: "Imported", type: "Color", value: "#445566" }); dependencySite.styleTokens.push(imported);
  const dep = new ProjectDependency({ uuid: "ref-dep", pkgId: "ref-pkg", projectId: "ref-project", name: "Reference colors", version: "1.0.0", site: dependencySite });
  f.appCtx.bundler.bundle(dep, "ref-dep-version", f.appCtx.lastBundleVersion);
  await f.studio.changeUnsafe(() => { f.site.projectDependencies.push(dep); f.head.value = mkTokenRef(imported); });
  const source = new StyleTokenRefInputs(f.studio, [mkTokenRef(f.head)], f.helper, "Color"), stop = source.subscribe(() => undefined), token = new OverrideableToken(imported, f.site);
  expect(source.getSnapshot().rows[0]?.resolved?.value).toBe("#445566");
  await f.studio.changeUnsafe(() => { token.setValue("#778899"); });
  expect(source.getSnapshot().rows[0]?.resolved?.value).toBe("#778899"); expect(imported.value).toBe("#445566"); stop();
});

it("reacts to lookup membership and immutable type replacements with the two original head policies", async () => {
  const f = await setup(), input = "var(--token-arriving)", color = new StyleTokenRefInputs(f.studio, [input], f.helper, "Color"), all = new StyleTokenRefInputs(f.studio, [input], f.helper, "all");
  const stopColor = color.subscribe(() => undefined), stopAll = all.subscribe(() => undefined);
  expect(color.getSnapshot().rows[0]?.applied).toBeUndefined();
  const arriving = new StyleToken({ uuid: "arriving", name: "Arriving color", type: "Color", value: "#010203", variantedValues: [], isRegistered: false, regKey: undefined });
  await f.studio.changeUnsafe(() => { f.site.styleTokens.push(arriving); });
  expect(color.getSnapshot().rows[0]?.resolved?.value).toBe("#010203");
  const replacement = new StyleToken({ uuid: "arriving", name: "Arriving spacing", type: "Spacing", value: "20px", variantedValues: [], isRegistered: false, regKey: undefined });
  await f.studio.changeUnsafe(() => { f.site.styleTokens.splice(f.site.styleTokens.indexOf(arriving), 1, replacement); });
  expect(color.getSnapshot().rows[0]?.applied).toBeUndefined(); expect(all.getSnapshot().rows[0]?.resolved?.value).toBe("20px"); stopColor(); stopAll();
});

it("keeps the original cycle result and distinguishes a missing head from a broken nested reference", async () => {
  const f = await setup();
  await f.studio.changeUnsafe(() => { f.middle.value = mkTokenRef(f.head); });
  const source = new StyleTokenRefInputs(f.studio, [mkTokenRef(f.head), "var(--token-missing)"], f.helper, "Color");
  const visits: string[] = [], original = resolveToken(siteFinalStyleTokensAllDeps(f.site), toFinalToken(f.head, f.site), f.helper, (token) => visits.push(token.name));
  expect(source.getSnapshot().rows[0]?.resolved?.value).toBe(original.value); expect(source.getSnapshot().rows[0]?.resolved?.ref).toBe(f.studio.modelSnapshots.ref(original.token.base));
  expect(visits).toEqual(["Head", "Middle", "Head", "Middle"]); expect(source.getSnapshot().rows[1]?.applied).toBeUndefined();
  await f.studio.changeUnsafe(() => { f.middle.value = "var(--token-broken)"; });
  expect(() => new StyleTokenRefInputs(f.studio, [mkTokenRef(f.head)], f.helper, "Color").getSnapshot()).toThrow("Expected to be a token ref");
});

class Boundary extends React.Component<React.PropsWithChildren, { error: Error | undefined }> {
  state: { error: Error | undefined } = { error: undefined };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() { return this.state.error ? <output data-testid="reference-error">{this.state.error.message}</output> : this.props.children; }
}
it("raises a broken alias in React rather than rejecting or rolling back the completed native model command", async () => {
  const f = await setup();
  function Value() { const input = useStyleTokenRefs(f.studio, [mkTokenRef(f.head)], f.helper, "Color", (snapshot) => snapshot.rows[0]?.resolved?.value); return <output>{input.selected}</output>; }
  render(<Boundary><Value /></Boundary>);
  await act(async () => { await expect(f.studio.changeUnsafe(() => { f.middle.value = "var(--token-broken)"; })).resolves.toBeUndefined(); });
  expect(screen.getByTestId("reference-error")).toHaveTextContent("Expected to be a token ref"); expect(f.middle.value).toBe("var(--token-broken)");
});

it("leaves abandoned reads disconnected and captures metadata between render and committed subscription without leaked leases", async () => {
  const f = await setup(), subscribe = f.studio.modelSnapshots.subscribePreparedField.bind(f.studio.modelSnapshots); let leases = 0;
  vi.spyOn(f.studio.modelSnapshots, "subscribePreparedField").mockImplementation((field, listener) => { leases++; const stop = subscribe(field, listener); let stopped = false; return () => { if (!stopped) { stopped = true; leases--; stop(); } }; });
  const pending = new Promise<void>(() => undefined);
  function Abandoned(): React.ReactNode { useStyleTokenRefs(f.studio, [mkTokenRef(f.head)], f.helper, "Color", (snapshot) => snapshot); throw pending; }
  const abandoned = render(<React.Suspense fallback={<span>Pending</span>}><Abandoned /></React.Suspense>); expect(leases).toBe(0); abandoned.unmount();
  const source = new StyleTokenRefInputs(f.studio, [mkTokenRef(f.head)], f.helper, "Color"); expect(source.getSnapshot().rows[0]?.applied?.name).toBe("Head");
  await f.studio.changeUnsafe(() => { f.head.name = "Committed name"; });
  const stop = source.subscribe(() => { source.getSnapshot(); });
  expect(source.getSnapshot().rows[0]?.applied?.name).toBe("Committed name"); expect(leases).toBeGreaterThan(0); stop(); expect(leases).toBe(0);
});

it("preserves registered CSS-variable selection in the real ColorButton and keeps its original picker command", async () => {
  vi.stubGlobal("__PlasmicTokenRegistry", [{ name: "registered-color", type: "color", value: "var(--reference-color)", selector: "#reference-palette" }]);
  const f = await setup(true); const changed = vi.fn();
  document.documentElement.style.setProperty("--reference-color", "#ABBA00");
  const palette = document.createElement("div"); palette.id = "reference-palette"; palette.style.setProperty("--reference-color", "#EECCAA"); document.body.appendChild(palette); extras.add(palette);
  const mounted = render(wrap(f, <ColorButton sc={f.studio} color={mkTokenRef(f.head)} onChange={changed} vsh={f.helper} />));
  expect(screen.getByText("Head")).toBeInTheDocument();
  expect([...mounted.container.querySelectorAll<HTMLElement>("[style]")].some((element) => element.style.backgroundColor === "rgb(238, 204, 170)")).toBe(true);
  await act(async () => { await f.studio.changeUnsafe(() => { f.end.value = "#ABCDEF"; f.head.name = "Renamed head"; }); });
  expect(screen.getByText("Renamed head")).toBeInTheDocument();
  fireEvent.click(ensure(screen.getByText("Renamed head").closest("button"), "Color trigger"));
  await waitFor(() => expect(document.querySelectorAll(".SwatchButton").length).toBeGreaterThan(0));
  fireEvent.mouseDown(ensure(document.querySelectorAll(".SwatchButton")[0], "Real token picker swatch"));
  await waitFor(() => expect(changed).toHaveBeenLastCalledWith(mkTokenRef(f.end))); mounted.unmount(); palette.remove();
});

it("updates actual gradient colors and keeps command interpolation fresh before React has repainted", async () => {
  const f = await setup();
  await f.studio.changeUnsafe(() => { f.end.value = "var(--fresh-gradient)"; });
  document.documentElement.style.setProperty("--fresh-gradient", "#123456");
  const stops = [new Stop(mkTokenRef(f.head), new Dim("0", "%")), new Stop("#FFFFFF", new Dim("100", "%"))], changed = vi.fn();
  const gradientWrites = vi.spyOn(CSSStyleDeclaration.prototype, "backgroundImage", "set");
  const mounted = render(wrap(f, <ColorStops studioCtx={f.studio} stops={stops} repeating={false} onChange={changed} vsh={f.helper} />));
  const bar = ensure(mounted.container.querySelector<HTMLElement>(".color-stops__bar"), "Gradient bar");
  Object.defineProperty(bar, "offsetWidth", { configurable: true, value: 100 });
  vi.spyOn(bar, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 100, 20));
  vi.spyOn(bar, "getClientRects").mockReturnValue(Object.assign([new DOMRect(0, 0, 100, 20)], { item: (index: number) => [new DOMRect(0, 0, 100, 20)][index] ?? null }));
  const firstChip = ensure(mounted.container.querySelector<HTMLElement>(".color-stop__color-chip"), "Original gradient color"), paintedColor = firstChip.style.backgroundColor;
  document.documentElement.style.setProperty("--fresh-gradient", "#000000");
  expect(firstChip.style.backgroundColor).toBe(paintedColor);
  await act(async () => {
    fireEvent.click(ensure(mounted.container.querySelector(".color-stops__bar-container"), "Gradient add command"), { clientX: 50, clientY: 10 });
  });
  expect(stops).toHaveLength(3); expect(stops[1]?.dim.getNumericValue()).toBe(50); expect(stops[1]?.color.toLowerCase()).toBe("#b4b4b4"); expect(changed).toHaveBeenCalledWith(stops);
  // jsdom 22 drops valid gradients during CSS serialization. Observe the real
  // delegated DOM setter rather than replacing its parser or the component.
  const barWrites = gradientWrites.mock.calls.filter((_call, index) => gradientWrites.mock.contexts[index] === bar.style);
  expect(barWrites.at(-1)?.[0]).toBe("linear-gradient(90deg, #000000 0%, #b4b4b4 50%, #FFFFFF 100%)");
  expect(ensure(mounted.container.querySelector<HTMLElement>(".color-stop__color-chip"), "Updated native gradient color").style.backgroundColor).toBe("rgb(0, 0, 0)"); mounted.unmount();
});

it("supports dynamic stop counts without conditional hooks and keeps raw token strings bound to the current world", async () => {
  const f = await setup(), initial = [new Stop(mkTokenRef(f.head), new Dim("0", "%")), new Stop("#FFFFFF", new Dim("100", "%"))];
  const contents = (stops: Stop[]) => wrap(f, <ColorStops studioCtx={f.studio} stops={stops} repeating={false} onChange={() => undefined} vsh={f.helper} />);
  const mounted = render(contents(initial));
  mounted.rerender(contents([...initial, new Stop("#000000", new Dim("120", "%"))])); expect(mounted.container.querySelectorAll(".color-stop")).toHaveLength(3);
  mounted.rerender(contents(initial)); expect(mounted.container.querySelectorAll(".color-stop")).toHaveLength(2); mounted.unmount();
  const button = render(wrap(f, <ColorButton sc={f.studio} color={mkTokenRef(f.head)} onChange={() => undefined} />));
  const nextSite = createSite(), nextHead = mkStyleToken({ name: "New world head", type: "Color", value: "#102030" });
  const sameId = new StyleToken({ uuid: f.head.uuid, name: nextHead.name, type: "Color", value: nextHead.value, variantedValues: [], isRegistered: false, regKey: undefined }); nextSite.styleTokens.push(sameId);
  const bundle = f.appCtx.bundler.bundle(nextSite, f.studio.siteInfo.id, f.appCtx.lastBundleVersion), release = mock<PkgVersionInfoMeta>({ id: "reference-world", pkgId: "reference-world-pkg", version: "1.0.0", branchId: null });
  f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: bundle }, depPkgs: [], etag: "reference-world-etag" });
  await act(async () => { await f.studio["loadVersion"](release, true); });
  expect(screen.getByText("New world head")).toBeInTheDocument(); expect(screen.queryByText("Head")).not.toBeInTheDocument(); button.unmount();
});

it("updates active VSH contexts while preserving resolved descriptor identity for name-only edits", async () => {
  const f = await setup(), manager = new TplMgr({ site: f.site }); let chosen: Variant | undefined;
  await f.studio.changeUnsafe(() => { const group = manager.createGlobalVariantGroup("Reference Theme"); chosen = manager.createGlobalVariant(group, "Dark"); f.end.variantedValues.push(new VariantedValue({ variants: [chosen], value: "#FFFFFF" })); });
  const dark = ensure(chosen, "Global variant"), painted = vi.fn();
  function View({ helper }: { helper: VariantedStylesHelper }) {
    painted(); const refs = useStyleTokenRefs(f.studio, [mkTokenRef(f.head)], helper, "Color", useShallow((snapshot) => snapshot.rows.map((row) => row.resolved)));
    return <output data-testid="variant-result">{refs.selected[0]?.value}</output>;
  }
  const base = new VariantedStylesHelper(f.site), active = new VariantedStylesHelper(f.site, [dark]);
  const mounted = render(<View helper={base} />); expect(screen.getByTestId("variant-result")).toHaveTextContent("#123456");
  mounted.rerender(<View helper={active} />); expect(screen.getByTestId("variant-result")).toHaveTextContent("#FFFFFF"); painted.mockClear();
  await act(async () => { await f.studio.changeUnsafe(() => { f.head.name = "Different label"; }); }); expect(painted).not.toHaveBeenCalled();
  mounted.rerender(<View helper={base} />); expect(screen.getByTestId("variant-result")).toHaveTextContent("#123456"); mounted.unmount();
});

it("keeps literal CSS free of token membership leases and snapshots the finite string inputs", async () => {
  const f = await setup(), fields = vi.spyOn(f.studio.modelSnapshots, "declaredField"), prepared = vi.spyOn(f.studio.modelSnapshots, "subscribePreparedField");
  const inputs = ["#123456", "var(--host-color)"];
  const source = new StyleTokenRefInputs(f.studio, inputs, f.helper, "Color"), initial = source.getSnapshot(), stop = source.subscribe(() => undefined);
  inputs[0] = mkTokenRef(f.head);
  expect(source.getSnapshot()).toBe(initial); expect(initial.rows.map((row) => row.input)).toEqual(["#123456", "var(--host-color)"]);
  expect(fields).not.toHaveBeenCalled(); expect(prepared).not.toHaveBeenCalled(); stop();
});

it("keeps a known old active VSH terminal across actual world replacement and admits a new current context", async () => {
  const f = await setup(), manager = new TplMgr({ site: f.site }); let chosen: Variant | undefined;
  await f.studio.changeUnsafe(() => { const group = manager.createGlobalVariantGroup("Reference Context"); chosen = manager.createGlobalVariant(group, "Dark"); f.end.variantedValues.push(new VariantedValue({ variants: [chosen], value: "#FFFFFF" })); });
  const dark = ensure(chosen, "Old active variant"), group = ensure(dark.parent, "Old global group"), oldModels = f.studio.modelSnapshots;
  const oldInputs = new Set<ObjInst>([dark, group, group.param, group.param.variable]);
  const helper = new VariantedStylesHelper(f.site, [dark]);
  function Value({ context }: { context: VariantedStylesHelper }) {
    const refs = useStyleTokenRefs(f.studio, [mkTokenRef(f.head)], context, "Color", (snapshot) => snapshot.rows[0]?.resolved?.value);
    return <output data-testid="context-admission">{refs.selected}</output>;
  }
  const mounted = render(<Value context={helper} />); expect(screen.getByTestId("context-admission")).toHaveTextContent("#FFFFFF");
  const nextSite = createSite(), nextManager = new TplMgr({ site: nextSite }), nextGroup = nextManager.createGlobalVariantGroup("Reference Context"), nextDark = nextManager.createGlobalVariant(nextGroup, "Dark");
  const nextHead = new StyleToken({ uuid: f.head.uuid, name: "Current context head", type: "Color", value: "#102030", variantedValues: [new VariantedValue({ variants: [nextDark], value: "#445566" })], isRegistered: false, regKey: undefined }); nextSite.styleTokens.push(nextHead);
  const bundle = f.appCtx.bundler.bundle(nextSite, f.studio.siteInfo.id, f.appCtx.lastBundleVersion), release = mock<PkgVersionInfoMeta>({ id: "active-context-world", pkgId: "active-context-pkg", version: "1.0.0", branchId: null });
  f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: bundle }, depPkgs: [], etag: "active-context-etag" });
  const declared = vi.spyOn(ModelSnapshots.prototype, "declaredField");
  await act(async () => { await f.studio["loadVersion"](release, true); });
  expect(declared.mock.calls.filter(([model], index) => declared.mock.contexts[index] !== oldModels && oldInputs.has(model))).toHaveLength(0);
  expect(screen.getByTestId("context-admission")).toHaveTextContent("#FFFFFF");
  const currentGroup = ensure(f.studio.site.globalVariantGroups.find((item) => item.param.variable.name === nextGroup.param.variable.name), "Current group"), currentDark = ensure(currentGroup.variants.find((item) => item.name === "Dark"), "Current variant");
  mounted.rerender(<Value context={new VariantedStylesHelper(f.studio.site, [currentDark])} />);
  expect(screen.getByTestId("context-admission")).toHaveTextContent("#445566"); mounted.unmount();
});

it("rejects a new foreign active VSH before any model field declaration", async () => {
  const f = await setup(), foreignSite = createSite(), manager = new TplMgr({ site: foreignSite }), group = manager.createGlobalVariantGroup("Foreign context"), variant = manager.createGlobalVariant(group, "Dark");
  const declared = vi.spyOn(f.studio.modelSnapshots, "declaredField");
  expect(() => new StyleTokenRefInputs(f.studio, [mkTokenRef(f.head)], new VariantedStylesHelper(foreignSite, [variant]), "Color")).toThrow("Active style context belongs to another model world");
  expect(declared).not.toHaveBeenCalled();
});

it("preserves first-array head/alias behavior and CssVarResolver last-dictionary head/alias behavior for duplicate UUIDs", async () => {
  const f = await setup(), dependencySite = createSite();
  const head = new StyleToken({ uuid: f.head.uuid, name: "Dictionary head", type: "Color", value: mkTokenRef(f.end), variantedValues: [], isRegistered: false, regKey: undefined });
  const tail = new StyleToken({ uuid: f.end.uuid, name: "Dictionary tail", type: "Color", value: "#FEDCBA", variantedValues: [], isRegistered: false, regKey: undefined });
  dependencySite.styleTokens.push(head, tail);
  const dep = new ProjectDependency({ uuid: "dictionary-dep", pkgId: "dictionary-pkg", projectId: "dictionary-project", name: "Dictionary colors", version: "1.0.0", site: dependencySite });
  f.appCtx.bundler.bundle(dep, "dictionary-version", f.appCtx.lastBundleVersion);
  await f.studio.changeUnsafe(() => { f.site.projectDependencies.push(dep); });
  const input = mkTokenRef(f.head), first = new StyleTokenRefInputs(f.studio, [input], f.helper, "Color"), allFirst = new StyleTokenRefInputs(f.studio, [input], f.helper, "all"), last = new StyleTokenRefInputs(f.studio, [input], f.helper, "dictionary");
  const stopFirst = first.subscribe(() => undefined), stopAll = allFirst.subscribe(() => undefined), stopLast = last.subscribe(() => undefined);
  expect(first.getSnapshot().rows[0]?.applied?.name).toBe("Head"); expect(first.getSnapshot().rows[0]?.resolved?.value).toBe("#123456");
  expect(allFirst.getSnapshot().rows[0]?.applied?.name).toBe("Head"); expect(allFirst.getSnapshot().rows[0]?.resolved?.value).toBe("#123456");
  // Exact prior dictionary contract, used only as a small fixture oracle.
  const legacy = new Map(siteFinalStyleTokensAllDeps(f.site).map((token) => [token.uuid, token]));
  const expected = resolveToken(legacy, ensure(legacy.get(f.head.uuid), "Legacy dictionary head"), f.helper);
  const row = ensure(last.getSnapshot().rows[0], "Dictionary result");
  expect(row.applied?.name).toBe("Dictionary head"); expect(row.applied?.ref).toBe(f.studio.modelSnapshots.ref(head));
  expect(row.resolved?.value).toBe(expected.value); expect(row.resolved?.value).toBe("#FEDCBA"); expect(row.resolved?.ref).toBe(f.studio.modelSnapshots.ref(expected.token.base));
  await f.studio.changeUnsafe(() => { new OverrideableToken(tail, f.site).setValue("#665544"); });
  expect(last.getSnapshot().rows[0]?.resolved?.value).toBe("#665544"); expect(first.getSnapshot().rows[0]?.resolved?.value).toBe("#123456");
  stopLast(); stopAll(); stopFirst();
});

it("keeps Color-only dereference and head-only labels distinct from all-style aliases", async () => {
  const f = await setup();
  const spacing = mkStyleToken({ name: "Non-color alias", type: "Spacing", value: "17px" });
  await f.studio.changeUnsafe(() => { f.site.styleTokens.push(spacing); f.head.value = mkTokenRef(spacing); });
  const allAliases = new StyleTokenRefInputs(f.studio, [mkTokenRef(f.head)], f.helper, "Color");
  const colorsOnly = new StyleTokenRefInputs(f.studio, [mkTokenRef(f.head)], f.helper, "ColorOnly");
  const label = new StyleTokenRefInputs(f.studio, [mkTokenRef(f.head)], f.helper, "ColorLabel");
  expect(allAliases.getSnapshot().rows[0]?.resolved?.value).toBe("17px");
  expect(() => colorsOnly.getSnapshot()).toThrow("Expected to be a token ref");
  const before = label.getSnapshot();
  expect(before.rows[0]?.applied?.name).toBe("Head"); expect(before.rows[0]?.resolved).toBeUndefined();
  await f.studio.changeUnsafe(() => { f.head.value = "var(--token-missing)"; });
  expect(label.getSnapshot()).toBe(before);
  await f.studio.changeUnsafe(() => { f.head.name = "Renamed head only"; });
  expect(label.getSnapshot().rows[0]?.applied?.name).toBe("Renamed head only");
  const changed = vi.fn(), stop = label.subscribe(changed);
  await f.studio.changeUnsafe(() => { f.head.value = "#AABBCC"; });
  expect(changed).not.toHaveBeenCalled();
  await f.studio.changeUnsafe(() => { f.head.name = "Connected label"; });
  expect(label.getSnapshot().rows[0]?.applied?.name).toBe("Connected label"); expect(changed).toHaveBeenCalledOnce();
  stop();
});

it("uses the original Spacing-only head and alias lookup without admitting other token types", async () => {
  const f = await setup(), end = mkStyleToken({ name: "Gap end", type: "Spacing", value: "8px" }), head = mkStyleToken({ name: "Gap", type: "Spacing", value: "0px" });
  await f.studio.changeUnsafe(() => { f.site.styleTokens.push(head, end); head.value = mkTokenRef(end); });
  const source = new StyleTokenRefInputs(f.studio, [mkTokenRef(head)], f.helper, "SpacingOnly"), stop = source.subscribe(() => undefined);
  expect(source.getSnapshot().rows[0]?.resolved?.value).toBe("8px");
  await f.studio.changeUnsafe(() => { end.value = "18px"; });
  expect(source.getSnapshot().rows[0]?.resolved?.value).toBe("18px");
  await f.studio.changeUnsafe(() => { head.value = mkTokenRef(f.end); });
  expect(() => source.getSnapshot()).toThrow("Expected to be a token ref");
  stop();
});

it("reads all-style head name/base value without resolving aliases or adding missing-alias errors", async () => {
  const f = await setup();
  await f.studio.changeUnsafe(() => { f.head.value = "var(--token-unavailable)"; });
  const source = new StyleTokenRefInputs(f.studio, [mkTokenRef(f.head)], f.helper, "allHead"), stop = source.subscribe(() => undefined);
  expect(source.getSnapshot().rows[0]?.applied?.name).toBe("Head");
  expect(source.getSnapshot().rows[0]?.resolved?.value).toBe("var(--token-unavailable)");
  await f.studio.changeUnsafe(() => { f.head.name = "Head renamed"; f.head.value = "13px"; });
  expect(source.getSnapshot().rows[0]?.applied?.name).toBe("Head renamed");
  expect(source.getSnapshot().rows[0]?.resolved?.value).toBe("13px");
  stop();
});


it("sorts direct color heads by name while retaining all-style first-UUID alias resolution", async () => {
  const f = await setup();
  const duplicate = new StyleToken({ uuid: f.head.uuid, name: "A sorted head", type: "Color", value: "#ABCDEF", variantedValues: [], isRegistered: false, regKey: undefined });
  const spacing = mkStyleToken({ name: "Cross-type alias", type: "Spacing", value: "#778899" });
  await f.studio.changeUnsafe(() => { f.site.styleTokens.push(duplicate, spacing); f.head.value = mkTokenRef(spacing); });
  const source = new StyleTokenRefInputs(f.studio, [mkTokenRef(f.head)], f.helper, "ColorDirectSorted"), changed = vi.fn();
  let installed = source.getSnapshot();
  const stop = source.subscribe(() => {
    const next = source.getSnapshot();
    if (next !== installed) { installed = next; changed(next); }
  });
  expect(source.getSnapshot().rows[0]?.applied?.name).toBe("A sorted head");
  expect(source.getSnapshot().rows[0]?.resolved?.value).toBe("#ABCDEF");
  await f.studio.changeUnsafe(() => { duplicate.name = "Z sorted head"; });
  expect(changed).toHaveBeenCalledOnce();
  expect(source.getSnapshot().rows[0]?.applied?.name).toBe("Head");
  expect(source.getSnapshot().rows[0]?.resolved?.value).toBe("#778899");
  stop();
});

it("keeps the mixin preview's last-UUID head and first-UUID alias contract", async () => {
  const f = await setup();
  const duplicateHead = new StyleToken({ uuid: f.head.uuid, name: "Last head", type: "Color", value: mkTokenRef(f.middle), variantedValues: [], isRegistered: false, regKey: undefined });
  const duplicateAlias = new StyleToken({ uuid: f.middle.uuid, name: "Unused later alias", type: "Color", value: "#FF0000", variantedValues: [], isRegistered: false, regKey: undefined });
  await f.studio.changeUnsafe(() => { f.site.styleTokens.push(duplicateHead, duplicateAlias); });
  const source = new StyleTokenRefInputs(f.studio, [mkTokenRef(f.head)], f.helper, "allLastHead"), changed = vi.fn(), stop = source.subscribe(changed);
  expect(source.getSnapshot().rows[0]?.applied?.ref).toBe(f.studio.modelSnapshots.ref(duplicateHead));
  expect(source.getSnapshot().rows[0]?.resolved?.value).toBe("#123456");
  const before = source.getSnapshot();
  await f.studio.changeUnsafe(() => { duplicateAlias.value = "#00FFFF"; });
  expect(source.getSnapshot()).toBe(before); expect(changed).not.toHaveBeenCalled();
  await f.studio.changeUnsafe(() => { f.middle.value = mkTokenRef(f.other); });
  expect(source.getSnapshot().rows[0]?.resolved?.value).toBe("#00FF00");
  expect(changed).toHaveBeenCalledOnce(); stop();
});

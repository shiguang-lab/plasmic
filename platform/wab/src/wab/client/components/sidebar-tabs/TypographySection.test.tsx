import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { ensureBaseVariantSetting } from "@/wab/shared/VariantTplMgr";
import type { GetProjectResponse } from "@/wab/shared/ApiSchema";
import { Bundler } from "@/wab/shared/bundler";
import { TextContentRow } from "@/wab/client/components/sidebar-tabs/TypographySection";
import { setEditingTextContext } from "@/wab/client/studio-ctx/editing-text-state";
import { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  EditingTextContext,
  ViewCtx,
} from "@/wab/client/studio-ctx/view-ctx";
import { assert, ensure } from "@/wab/shared/common";
import {
  RawTextLike,
  TplTagType,
  isTplTextBlock,
  mkTplTagX,
} from "@/wab/shared/core/tpls";
import { ValTextTag } from "@/wab/shared/core/val-nodes";
import { Arena, type DataToken, RawText, type TplTag, isKnownRawText, isKnownExprText } from "@/wab/shared/model/classes";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/components/tpl-text-ops", () => ({
  makeTplTextOps: (viewCtx: ViewCtx, tpl: TplExpsProvider["tpl"]) => ({
    effectiveVs: viewCtx.effectiveCurrentVariantSetting(tpl),
    indicator: { source: "none" },
    isDisabled: false,
    actions: {},
  }),
  makeTplTextMenu: () => null,
}));

vi.mock("@/wab/client/components/sidebar-tabs/ComponentProps/DataPickerEditor", () => ({ DataPickerEditor: ({ visible }: { visible: boolean }) => visible ? <output aria-label="Text data picker">Open</output> : null }));
vi.mock("@/wab/client/components/sidebar/DataTokenEditModal", () => ({ DataTokenEditModal: ({ token }: { token: DataToken }) => <output aria-label="Created text token">{token.name}</output> }));

const studios = new Set<StudioCtx>();
const previousScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
beforeAll(() => { Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() }); });
afterAll(() => { if (previousScroll) { Object.defineProperty(HTMLElement.prototype, "scrollIntoView", previousScroll); } else { Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView"); } });
afterEach(async () => {
  await act(async () => { cleanup(); });
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear(); vi.restoreAllMocks();
});

async function setup() {
  const fixture = await actualText("Draft text"), viewCtx = fixture.view, tpl = fixture.tpl;
  await fixture.studio.changeUnsafe(() => { ensure(tpl.vsettings[0], "Real text setting").text = new RawText({ text: "内部名称1", markers: [] }); });
  const text = ensure(tpl.vsettings[0].text, "Real model text");
  assert(isKnownRawText(text), "Expected real raw text");
  let current: EditingTextContext | null = null;
  const context = { get: () => current, set: (value: EditingTextContext | null) => { current = value; } };
  render(fixture.row());
  vi.spyOn(viewCtx, "change");
  const startEditing = (node: TplTag = tpl) => {
    assert(isTplTextBlock(node), "Expected a text template");
    context.set({
        val: new ValTextTag({
          tpl: node,
          key: node.uuid,
          fullKey: node.uuid,
          frameUid: 1,
          valOwner: undefined,
          parent: undefined,
          slotInfo: undefined,
          className: "text",
          children: [],
          fibers: [],
          text,
        }),
        targetVs: tpl.vsettings[0],
        draftText: text,
        run: undefined,
        editor: undefined,
      });
    syncEditingText();
  };
  const syncEditingText = () =>
    setEditingTextContext(viewCtx, context.get() ? { ...ensure(context.get(), "Expected an active text edit") } : null);
  const draft = (value: string | undefined) => {
    ensure(context.get(), "Expected an active text edit").draftText =
      value === undefined ? undefined : new RawTextLike(value, []);
    syncEditingText();
  };
  return { context, viewCtx, text, tpl, startEditing, draft };
}

it("shows typing, deletion and undo drafts immediately without committing the model", async () => {
  const f = await setup();
  const content = screen.getByRole("button", { name: "内部名称1" });
  act(() => f.startEditing());
  expect(f.context.get()?.val.tpl).toBe(f.tpl);
  act(() => f.draft("内部名称123"));
  expect(content.textContent).toBe("内部名称123");
  act(() => f.draft(""));
  expect(content.textContent).toBe("");
  act(() => f.draft("内部名称1"));
  expect(content.textContent).toBe("内部名称1");
  expect(f.text.text).toBe("内部名称1");
  expect(f.viewCtx.change).not.toHaveBeenCalled();
});

it("falls back to the model after the draft is cleared or editing ends", async () => {
  const f = await setup();
  const content = screen.getByRole("button", { name: "内部名称1" });
  act(() => f.startEditing());
  act(() => f.draft("Draft"));
  act(() => f.draft(undefined));
  expect(content.textContent).toBe("内部名称1");
  act(() => f.draft("Draft"));
  act(() => {
    f.context.set(null);
    setEditingTextContext(f.viewCtx, null);
  });
  expect(content.textContent).toBe("内部名称1");
});

it("does not display another text node's draft", async () => {
  const f = await setup();
  act(() => f.startEditing(mkTplTagX("span", { type: TplTagType.Text })));
  act(() => f.draft("Other text"));
  expect(screen.getByRole("button", { name: "内部名称1" })).toBeTruthy();
});

async function actualText(name = "Text requests") {
  // jsdom has no canvas viewport; keep actual ViewCtx evaluation paused.
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue();
  const site = createSite();
  const component = mkComponent({ name, type: ComponentType.Plain, tplTree: (baseVariant) => mkTplTagX("span", { type: TplTagType.Text, baseVariant }) });
  site.components.push(component);
  const tpl = component.tplTree;
  assert(isTplTextBlock(tpl), "Actual text template");
  ensureBaseVariantSetting(component, tpl).text = new RawText({ text: "Business text", markers: [] });
  const frame = mkArenaFrame({ site, component, name, width: 200, height: 100 });
  const arena = new Arena({ name, children: [frame] });
  site.arenas.splice(0, site.arenas.length, arena);
  const f = fakeStudioCtx({ site, initialUrl: `/projects/test?arena_type=custom&arena=${encodeURIComponent(name)}`, devFlagOverrides: { ccStubs: true } });
  const studio = f.studioCtx; studios.add(studio);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  expect(studio.currentArena).toBe(arena);
  studio.observeComponents([component]); studio.createViewStateUndoRecord();
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Actual text ViewCtx");
  // The prototype seams also pause replacement views created after retirement.
  view.selection.setTpls([tpl]);
  const expsProvider = new TplExpsProvider(view, tpl);
  const row = () => <StudioCtxContext.Provider value={studio}><TextContentRow viewCtx={view} expsProvider={expsProvider} /></StudioCtxContext.Provider>;
  return { ...f, studio, site, component, frame, tpl, view, row };
}

it("uses actual text conversion commands and consumes independent picker/token requests exactly once", async () => {
  const f = await actualText();
  const { makeTplTextOps } = await vi.importActual<typeof import("@/wab/client/components/tpl-text-ops")>("@/wab/client/components/tpl-text-ops");
  const pending = f.view.textDataRequestsStore.getState();
  expect(pending).toEqual({ editing: null, creating: null });
  await act(async () => { ensure(makeTplTextOps(f.view, f.tpl).actions.convertToDynamicValue, "Convert actual text")(); await f.studio.awaitEval(); });
  expect(f.view.triggerEditingTextDataPicker()).toBe(true);
  const editing = f.view.textDataRequestsStore.getState();
  f.view.setTriggerEditingTextDataPicker(true);
  expect(f.view.textDataRequestsStore.getState()).toBe(editing);
  const rendered = render(f.row());
  expect((await screen.findByLabelText("Text data picker")).textContent).toBe("Open");
  expect(f.view.triggerEditingTextDataPicker()).toBe(false);
  expect(isKnownExprText(ensure(f.tpl.vsettings[0], "Text base").text)).toBe(true);
  rendered.unmount();
  await act(async () => { await f.studio.changeUnsafe(() => { ensure(f.tpl.vsettings[0], "Text base").text = new RawText({ text: "Token business text", markers: [] }); }); });
  await act(async () => { ensure(makeTplTextOps(f.view, f.tpl).actions.createDataToken, "Actual create token")(); await f.studio.awaitEval(); });
  const token = ensure(f.site.dataTokens[0], "Created text data token");
  const creating = f.view.textDataRequestsStore.getState();
  expect(creating.creating?.uid).toBe(token.uid);
  expect(Object.isFrozen(creating)).toBe(true);
  f.view.setTriggerEditingTextDataPicker(true);
  expect(f.view.textDataRequestsStore.getState().creating).toBe(creating.creating);
  const both = f.view.textDataRequestsStore.getState();
  f.view.setTriggerCreatingTextDataToken(token);
  expect(f.view.textDataRequestsStore.getState()).toBe(both);
  const change = vi.spyOn(f.view, "change");
  render(f.row());
  expect((await screen.findByLabelText("Created text token")).textContent).toBe(token.name);
  expect((await screen.findByLabelText("Text data picker")).textContent).toBe("Open");
  await f.studio.awaitEval();
  expect(change).toHaveBeenCalledOnce();
  expect(f.view.textDataRequestsStore.getState()).toEqual({ editing: false, creating: null });
  expect(creating.creating?.uid).toBe(token.uid);
});

it("detaches old views, retains unmounted requests and clears refs before actual Studio disposal", async () => {
  const first = await actualText("First text"), second = await actualText("Second text");
  const rendered = render(first.row());
  second.view.setTriggerEditingTextDataPicker(true);
  rendered.rerender(second.row());
  expect(second.view.triggerEditingTextDataPicker()).toBe(false);
  act(() => { first.view.setTriggerEditingTextDataPicker(true); });
  expect(first.view.triggerEditingTextDataPicker()).toBe(true);
  rendered.unmount();
  second.view.setTriggerEditingTextDataPicker(true);
  expect(second.view.triggerEditingTextDataPicker()).toBe(true);
  let token: DataToken | undefined;
  await second.studio.changeUnsafe(() => { token = second.studio.tplMgr().addDataToken({ name: "Pending text", value: '"pending"' }); });
  second.view.setTriggerCreatingTextDataToken(ensure(token, "Pending text token"));
  const pending = second.view.textDataRequestsStore.getState();
  const resolve = vi.spyOn(second.studio.modelSnapshots, "resolve");
  second.studio.dispose(); studios.delete(second.studio);
  expect(second.view.textDataRequestsStore.getState()).toEqual({ editing: null, creating: null });
  expect(second.view.getTriggerCreatingTextDataToken()).toBeNull();
  expect(resolve.mock.calls.some(([ref]) => ref === pending.creating)).toBe(false);
});

it("clears pending text model refs when actual loadVersion replaces their scope", async () => {
  const f = await actualText("OldScope");
  let token: DataToken | undefined;
  await f.studio.changeUnsafe(() => { token = f.studio.tplMgr().addDataToken({ name: "Old text", value: '"old"' }); });
  f.view.setTriggerCreatingTextDataToken(ensure(token, "Old-scope text token"));
  f.view.setTriggerEditingTextDataPicker(true);
  const request = f.view.textDataRequestsStore.getState();
  const oldModels = f.studio.modelSnapshots, resolve = vi.spyOn(oldModels, "resolve");
  Object.assign(f.appCtx, { lastBundleVersion: "test" });
  const bundle = new Bundler().bundle(createSite(), f.studio.siteInfo.id, "test");
  f.api.getSiteInfo.mockResolvedValueOnce(mock<GetProjectResponse>({ rev: { data: JSON.stringify(bundle), revision: 1 }, depPkgs: [] }));
  await f.studio["loadVersion"]();
  expect(f.view.isDisposed).toBe(true);
  expect(f.studio.modelSnapshots).not.toBe(oldModels);
  expect(f.view.textDataRequestsStore.getState()).toEqual({ editing: null, creating: null });
  expect(f.view.getTriggerCreatingTextDataToken()).toBeNull();
  expect(resolve.mock.calls.some(([ref]) => ref === request.creating)).toBe(false);
});

it("refreshes real raw text without a project revision subscription", async () => {
  const f = await actualText("Native text fields");
  const mounted = render(f.row());
  const setting = ensure(f.tpl.vsettings[0], "Original text setting"), raw = ensure(setting.text, "Original raw text");
  assert(isKnownRawText(raw), "Expected original raw text");
  await act(async () => { await f.studio.changeUnsafe(() => { raw.text = "Changed business text"; }); });
  expect(screen.getByRole("button", { name: "Changed business text" })).toBeTruthy(); expect(setting.text).toBe(raw);
  act(() => f.studio.disposeViewCtx(f.view));
  expect(screen.queryByRole("button", { name: "Changed business text" })).toBeNull(); mounted.unmount();
});

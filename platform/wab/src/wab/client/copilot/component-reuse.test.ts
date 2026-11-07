import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { reviewComponents, shouldReviewRegion, componentDocuments } from "@/wab/client/copilot/component-reuse";
import { mkComponent, ComponentType } from "@/wab/shared/core/components";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { runInAction } from "mobx";
import { getBaseVariant } from "@/wab/shared/Variants";
import { mkTplTagX, mkTplComponentX, mkTplInlinedText } from "@/wab/shared/core/tpls";
import { createSite } from "@/wab/shared/core/sites";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";
import type { TopFrameApi } from "@/wab/client/frame-ctx/top-frame-api";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import { ensure } from "@/wab/shared/common";
import { mkParam } from "@/wab/shared/core/lang";
import { typeFactory } from "@/wab/shared/model/model-util";

const purpose = { purpose: "选择信息类别，切换客户信息内容" };
const candidate = { componentUuid: "registered-tabs", name: "Tabs", fromProject: "library", version: "1", description: "Switch content panels", similarity: .8, keywordScore: 0, rankScore: 1 / 61, keywordCoverage: 0, matchedTerms: [], matchedBy: ["embedding"], contract: { props: [], slots: [], events: [], truncated: false }, unknowns: ["Read the full contract"] };
function customRegion() { return mkTplTagX("div", {}, [mkTplTagX("button"), mkTplTagX("div")]); }
function fixture() {
  const site = createSite(); const root = customRegion(); const page = mkComponent({ name: "Customers", type: ComponentType.Page, tplTree: root }); site.components.push(page);
  const { studioCtx } = fakeStudioCtx({ site, devFlagOverrides: { enableComponentReuseAdvisory: true } });
  const sync = vi.fn().mockResolvedValue({});
  const review = vi.fn().mockResolvedValue({ status: "completed", indexed: 1, total: 1, elapsedMs: 10, suggestions: [] });
  const native = { sync, review, cancel: vi.fn(), activity: vi.fn(), release: vi.fn().mockResolvedValue(undefined) };
  const wire = (studio: typeof studioCtx) => {
    const api = mock<TopFrameApi>({ componentReuse: vi.fn(async request => {
    if (request.command === "status") return { available: true };
    if (request.command === "sync" || request.command === "review") { const { command, ...input } = request; return native[command](input); }
    if (request.command === "cancel") return native.cancel(request.id);
    if (request.command === "activity") return native.activity();
    return native.release(request.projectId);
    }) });
    runInAction(() => { studio.appCtx.topFrameApi = api; });
    return api;
  };
  const api = wire(studioCtx);
  const operations = [{ name: "insertHtml", input: { componentUuid: page.uuid } }];
  const receipts = [{ name: "insertHtml", componentUuid: page.uuid, created: [{ kind: "Element", uuid: root.uuid, componentUuid: page.uuid }] }];
  return { studioCtx, page, root, operations, receipts, sync, review, wire, api };
}
afterEach(() => { delete (window as any).desktopComponentReuse; });
describe("component advisory preflight", () => {
  it("skips presentation, copy and layout changes without inspecting their prose", () => {
    const root = customRegion();
    for (const input of [{ styles: { color: "red" } }, { text: "New copy" }, { name: "Controls" }]) expect(shouldReviewRegion([{ name: "changeElement", input }], root)).toBe(false);
    expect(shouldReviewRegion([{ name: "moveElement", input: {} }], root)).toBe(false);
    expect(shouldReviewRegion([{ name: "insertHtml", input: {} }], mkTplTagX("div", {}, [mkTplTagX("p")]))).toBe(false);
    expect(shouldReviewRegion([{ name: "insertHtml", input: {} }], mkTplTagX("div", {}, [mkTplTagX("div"), mkTplTagX("div"), mkTplTagX("div"), mkTplTagX("div")]))).toBe(false);
  });
  it("skips registered components and their normal Slot text/layout", () => {
    const definition = mkCodeComponent("LibraryTabs", { name: "LibraryTabs", importPath: "tabs", props: {} }, {});
    const instance = mkTplComponentX({ component: definition, baseVariant: getBaseVariant(definition) });
    expect(shouldReviewRegion([{ name: "changeElement", input: { props: { activeKey: "info" } } }], instance)).toBe(false);
    expect(shouldReviewRegion([{ name: "insertHtml", input: {} }], mkTplTagX("div", {}, [instance, mkTplTagX("p")]))).toBe(false);
  });
  it("still reviews a new native widget beside an existing registered component", () => {
    const definition = mkCodeComponent("LibraryButton", { name: "LibraryButton", importPath: "button", props: {} }, {});
    const root = mkTplTagX("div", {}, [mkTplComponentX({ component: definition, baseVariant: getBaseVariant(definition) }), mkTplTagX("button")]);
    expect(shouldReviewRegion([{ name: "insertHtml", input: {} }], root)).toBe(true);
  });
  it("reviews semantic div widgets and repeated populated rows without flagging empty layout", () => {
    const f = fixture(); const baseVariant = getBaseVariant(f.page);
    const text = (value: string) => mkTplInlinedText(value, [baseVariant]);
    const rows = Array.from({ length: 3 }, () => mkTplTagX("div", {}, [mkTplTagX("div", {}, [text("Name")]), mkTplTagX("div", {}, [text("Value")])]));
    const table = mkTplTagX("div", {}, rows);
    expect(shouldReviewRegion(f.operations, table)).toBe(true);
    const tabs = mkTplTagX("div", { attrs: { role: "tablist" }, baseVariant });
    expect(shouldReviewRegion(f.operations, tabs)).toBe(true);
    const card = mkCodeComponent("Card", { name: "Card", importPath: "card", props: { children: { type: "slot" } } }, {});
    card.params.push(mkParam({ name: "children", paramType: "slot", type: typeFactory.renderable() }));
    const wrapped = mkTplComponentX({ component: card, baseVariant: getBaseVariant(card), children: [table] });
    expect(shouldReviewRegion(f.operations, wrapped)).toBe(true);
    const mixed = mkTplTagX("div", {}, [mkTplComponentX({ component: card, baseVariant: getBaseVariant(card) }), tabs]);
    expect(shouldReviewRegion(f.operations, mixed)).toBe(true);
  });
  it("reports unknown skipped coverage and retains the last measured snapshot", async () => {
    const f = fixture();
    const before = await reviewComponents(f.studioCtx, [], [], purpose);
    expect([before.indexed, before.total]).toEqual([null, null]);
    await reviewComponents(f.studioCtx, f.operations, f.receipts, purpose);
    const after = await reviewComponents(f.studioCtx, [], [], purpose);
    expect([after.indexed, after.total]).toEqual([1, 1]);
  });
  it("offers a read-only recovery call and does not consume the final advisory while indexing", async () => {
    const f = fixture();
    const suggestion = { componentUuid: f.page.uuid, elementUuid: f.root.uuid, intent: purpose.purpose, candidates: [candidate], guidance: "Read contract" };
    f.review.mockResolvedValueOnce({ status: "indexing", indexed: 0, total: 1, elapsedMs: 1, issues: ["indexing"], suggestions: [suggestion] });
    const provisional = await reviewComponents(f.studioCtx, f.operations, f.receipts, purpose);
    expect(provisional.retry).toEqual({ tool: "execute", arguments: { name: "reviewComponentReuse", input: { targets: [{ componentUuid: f.page.uuid, elementUuid: f.root.uuid }], reviewContext: purpose } }, afterMs: 1000 });
    const retryInput = ensure(provisional.retry, "Read-only recovery call").arguments.input;
    f.review.mockResolvedValue({ status: "completed", indexed: 1, total: 1, elapsedMs: 1, suggestions: [suggestion] });
    const counter = f.studioCtx._changeCounter;
    const final = JSON.parse(await COPILOT_TOOLS.reviewComponentReuse.execute(f.studioCtx, retryInput));
    expect(final.suggestions[0].candidates).toHaveLength(1);
    expect(f.sync.mock.calls.at(-1)?.[0].retry).toBe(true);
    expect(f.studioCtx._changeCounter).toBe(counter);
    const repeated = JSON.parse(await COPILOT_TOOLS.reviewComponentReuse.execute(f.studioCtx, retryInput));
    expect(repeated.status).toBe("skipped"); expect(f.review).toHaveBeenCalledTimes(2);
  });
  it("keeps required parents when deduplication removes an earlier standalone recommendation", async () => {
    const f = fixture();
    const suggestion = { componentUuid: f.page.uuid, elementUuid: f.root.uuid, intent: purpose.purpose, candidates: [candidate], guidance: "Read contract" };
    f.review.mockResolvedValue({ status: "completed", indexed: 1, total: 1, elapsedMs: 1, suggestions: [suggestion] });
    await reviewComponents(f.studioCtx, f.operations, f.receipts, purpose);
    const root = customRegion(); runInAction(() => { f.page.tplTree = root; });
    const child = { ...candidate, componentUuid: "tab-item", name: "TabItem", contract: { ...candidate.contract, parent: "Tabs" } };
    f.review.mockResolvedValue({ status: "completed", indexed: 2, total: 2, elapsedMs: 1, suggestions: [{ ...suggestion, elementUuid: root.uuid, candidates: [{ ...candidate, requiredBy: [child.componentUuid] }, child] }] });
    const result = await reviewComponents(f.studioCtx, f.operations, [{ name: "insertHtml", componentUuid: f.page.uuid, created: [{ kind: "Element", uuid: root.uuid, componentUuid: f.page.uuid }] }], purpose);
    expect(result.suggestions[0].candidates.map(item => item.componentUuid)).toEqual([candidate.componentUuid, child.componentUuid]);
  });
  it("keeps local AI recovery within its bound page and never saves or mutates the design", async () => {
    const f = fixture();
    const outside = mkComponent({ name: "Outside", type: ComponentType.Page, tplTree: customRegion() });
    runInAction(() => { f.studioCtx.site.components.push(outside); });
    const context = JSON.parse(await COPILOT_TOOLS.getEditorContext.execute(f.studioCtx, {}));
    const binding = { projectId: context.projectId, branchId: context.branchId, sessionId: context.sessionId, changeCounter: context.changeCounter, componentUuid: f.page.uuid, elementUuids: [] };
    const save = vi.spyOn(f.studioCtx, "save").mockRejectedValue(new Error("Review must not save"));
    const execution = { operationId: "review", fence: 1 };
    const input = { targets: [{ componentUuid: f.page.uuid, elementUuid: f.root.uuid }], reviewContext: purpose };
    const output = JSON.parse(await COPILOT_TOOLS.executeLocalEdit.execute(f.studioCtx, { binding, execution, name: "reviewComponentReuse", input }));
    expect(output.changed).toBe(false); expect(JSON.parse(output.result).status).toBe("completed"); expect(save).not.toHaveBeenCalled();
    await expect(COPILOT_TOOLS.executeLocalEdit.execute(f.studioCtx, { binding, execution, name: "reviewComponentReuse", input: { ...input, targets: [{ componentUuid: outside.uuid, elementUuid: outside.tplTree.uuid }] } })).rejects.toThrow("outside the bound");
    expect(f.review).toHaveBeenCalledOnce(); expect(save).not.toHaveBeenCalled();
  });
  it("bounds recovery metadata with suggestions without consuming a truncated advisory", async () => {
    const f = fixture(); const context = { purpose: "数".repeat(500) };
    const suggestion = { componentUuid: f.page.uuid, elementUuid: f.root.uuid, intent: context.purpose, candidates: [candidate], guidance: "Read contracts" };
    const native = { status: "indexing", indexed: 0, total: 1, elapsedMs: 1, suggestions: [suggestion], guidance: "" };
    native.guidance = "x".repeat(5000 - new TextEncoder().encode(JSON.stringify(native)).length);
    expect(new TextEncoder().encode(JSON.stringify(native)).length).toBeLessThanOrEqual(5120);
    f.review.mockResolvedValueOnce(native);
    const provisional = await reviewComponents(f.studioCtx, f.operations, f.receipts, context);
    expect(new TextEncoder().encode(JSON.stringify(provisional)).length).toBeLessThanOrEqual(6144);
    expect(provisional.issues).toContain("output-truncated"); expect(provisional.suggestions).toEqual([]);
    f.review.mockResolvedValue({ status: "completed", indexed: 1, total: 1, elapsedMs: 1, suggestions: [suggestion] });
    const final = JSON.parse(await COPILOT_TOOLS.reviewComponentReuse.execute(f.studioCtx, ensure(provisional.retry, "Retry after indexing").arguments.input));
    expect(final.suggestions).toHaveLength(1);
  });
  it("does not even call retrieval when the user explicitly chose custom UI", async () => {
    const f = fixture();
    const result = await reviewComponents(f.studioCtx, f.operations, f.receipts, { ...purpose, customOnly: true });
    expect(result.status).toBe("skipped"); expect(f.review).not.toHaveBeenCalled();
  });
  it.each([undefined, false])("retrieves a functional request when customOnly is %s", async customOnly => {
    const f = fixture();
    await reviewComponents(f.studioCtx, f.operations, f.receipts, { ...purpose, customOnly });
    expect(f.review).toHaveBeenCalledOnce();
    expect(f.review.mock.calls[0][0].regions[0].intent).toContain("选择信息类别");
  });
  it("suggests at most once for the same session/area, even if purpose text is rewritten", async () => {
    const f = fixture();
    f.review.mockResolvedValue({ status: "completed", indexed: 1, total: 1, elapsedMs: 10, suggestions: [{ componentUuid: f.page.uuid, elementUuid: f.root.uuid, intent: "切换", candidates: [candidate], guidance: "Reassess once" }] });
    await reviewComponents(f.studioCtx, f.operations, f.receipts, purpose, "agent-1");
    await reviewComponents(f.studioCtx, f.operations, f.receipts, { purpose: "另一种说法" }, "agent-1");
    expect(f.review).toHaveBeenCalledOnce();
  });
  it("preserves the once-only boundary across replacement node identities", async () => {
    const f = fixture();
    f.review.mockResolvedValue({ status: "completed", indexed: 1, total: 1, elapsedMs: 1, suggestions: [{ componentUuid: f.page.uuid, elementUuid: f.root.uuid, intent: "Switch content", candidates: [candidate], guidance: "Reassess once" }] });
    const context = purpose;
    await reviewComponents(f.studioCtx, f.operations, f.receipts, context, "agent");
    const replacement = customRegion(); runInAction(() => { f.page.tplTree = replacement; });
    await reviewComponents(f.studioCtx, [{ name: "insertHtml", input: { componentUuid: f.page.uuid, elementUuid: f.root.uuid, location: "replace" } }],
      [{ name: "insertHtml", componentUuid: f.page.uuid, replacedElementUuid: f.root.uuid, created: [{ kind: "Element", uuid: replacement.uuid, componentUuid: f.page.uuid }] }], context, "agent");
    expect(f.review).toHaveBeenCalledOnce();
  });
  it("does not offer the same candidate again after repeated delete-and-rebuild edits", async () => {
    const f = fixture();
    const { studioCtx } = fakeStudioCtx({ devFlagOverrides: { enableComponentReuseAdvisory: true } });
    f.wire(studioCtx);
    f.review.mockImplementation(async input => ({ status: "completed", indexed: 1, total: 1, elapsedMs: 1,
      suggestions: input.regions.map((region: any) => ({ ...region, candidates: [candidate], guidance: "Reassess once" })),
    }));
    const page = JSON.parse(await COPILOT_TOOLS.createComponent.execute(studioCtx, {
      name: "Actions", type: "page", path: "/actions", reviewContext: { purpose: "Create an actions page" },
    }));
    const componentUuid = page.created[0].uuid;
    let result = JSON.parse(await COPILOT_TOOLS.insertHtml.execute(studioCtx, {
      componentUuid, html: "<button>Confirm</button>", reviewContext: purpose,
    }));
    const counts = [result.componentReview.suggestions.length];
    let elementUuid = result.created[0].uuid;
    for (let i = 0; i < 3; i++) {
      result = JSON.parse(await COPILOT_TOOLS.executeBatch.execute(studioCtx, {
        operations: [
          { name: "deleteElement", input: { componentUuid, elementUuid } },
          { name: "insertHtml", input: { componentUuid, html: `<button>Confirm ${i}</button>` } },
        ],
        reviewContext: { purpose: `Reassess the confirmation control, attempt ${i}` },
      }));
      counts.push(result.componentReview.suggestions.length);
      expect(result.operations[1].replacedElementUuid).toBeUndefined();
      expect(studioCtx.copilotActivity.store.getState().requests.at(-1)?.status).toBe("success");
      elementUuid = result.operations[1].created[0].uuid;
    }
    expect(counts).toEqual([1, 0, 0, 0]);
  });
  it("still offers a different candidate on the same page", async () => {
    const f = fixture();
    f.review.mockImplementation(async input => ({ status: "completed", indexed: 2, total: 2, elapsedMs: 1,
      suggestions: input.regions.map((region: any) => ({ ...region, candidates: [candidate], guidance: "Reassess once" })),
    }));
    await reviewComponents(f.studioCtx, f.operations, f.receipts, purpose, "agent");
    const replacement = customRegion();
    runInAction(() => { f.page.tplTree = replacement; });
    const other = { ...candidate, componentUuid: "registered-button", name: "Button" };
    f.review.mockImplementation(async input => ({ status: "completed", indexed: 2, total: 2, elapsedMs: 1,
      suggestions: input.regions.map((region: any) => ({ ...region, candidates: [candidate, other], guidance: "Reassess once" })),
    }));
    const result = await reviewComponents(f.studioCtx, f.operations,
      [{ name: "insertHtml", componentUuid: f.page.uuid, created: [{ kind: "Element", uuid: replacement.uuid, componentUuid: f.page.uuid }] }], purpose, "agent");
    expect(result.suggestions[0].candidates.map(item => item.componentUuid)).toEqual([other.componentUuid]);
  });
  it("can offer the same candidate on another page in the same session", async () => {
    const f = fixture(); const root = customRegion();
    const page = mkComponent({ name: "AnotherPage", type: ComponentType.Page, tplTree: root });
    runInAction(() => { f.studioCtx.site.components.push(page); });
    f.review.mockImplementation(async input => ({ status: "completed", indexed: 1, total: 1, elapsedMs: 1,
      suggestions: input.regions.map((region: any) => ({ ...region, candidates: [candidate], guidance: "Reassess once" })),
    }));
    const first = await reviewComponents(f.studioCtx, f.operations, f.receipts, purpose, "agent");
    const second = await reviewComponents(f.studioCtx, [{ name: "insertHtml", input: { componentUuid: page.uuid } }],
      [{ name: "insertHtml", componentUuid: page.uuid, created: [{ kind: "Element", uuid: root.uuid, componentUuid: page.uuid }] }], purpose, "agent");
    expect(first.suggestions).toHaveLength(1);
    expect(second.suggestions).toHaveLength(1);
  });
  it("drops stale advice if the model changed during the query", async () => {
    const f = fixture();
    f.review.mockImplementation(async () => { runInAction(() => { f.studioCtx._changeCounter++; }); return { status: "completed", indexed: 1, total: 1, elapsedMs: 10, suggestions: [] }; });
    const result = await reviewComponents(f.studioCtx, f.operations, f.receipts, purpose);
    expect(result.status).toBe("partial"); expect(result.suggestions).toEqual([]);
  });
  it("does not inventory pages as reusable components", () => { const f = fixture(); expect(componentDocuments(f.studioCtx).documents.some(doc => doc.componentUuid === f.page.uuid)).toBe(false); });
  it("uses the same first-registration precedence as live contract reads", () => {
    const first = { name: "SharedControl", importPath: "host", description: "Host contract", props: { value: "string" as const } };
    const second = { ...first, importPath: "library", description: "Different library contract" };
    const definition = mkCodeComponent(first.name, first, {}); const site = createSite(); site.components.push(definition);
    const { studioCtx } = fakeStudioCtx({ site });
    vi.spyOn(studioCtx, "getCodeComponentsRegistration").mockReturnValue([{ component: () => null, meta: first }, { component: () => null, meta: second }]);
    expect(componentDocuments(studioCtx).documents[0].description).toBe(studioCtx.getCodeComponentMeta(definition)?.description);
    expect(componentDocuments(studioCtx).documents[0].description).toBe("Host contract");
  });
  it("derives separate targets across definitions from receipts without agent mappings", async () => {
    const f = fixture(); const secondRoot = customRegion();
    const second = mkComponent({ name: "AnotherPage", type: ComponentType.Page, tplTree: secondRoot });
    runInAction(() => { f.studioCtx.site.components.push(second); });
    await reviewComponents(f.studioCtx, [...f.operations, { name: "insertHtml", input: { componentUuid: second.uuid } }],
      [...f.receipts, { name: "insertHtml", componentUuid: second.uuid, created: [{ kind: "Element", uuid: secondRoot.uuid, componentUuid: second.uuid }] }], purpose);
    expect(f.review).toHaveBeenCalledOnce();
    expect(f.review.mock.calls[0][0].regions.map((region: any) => [region.componentUuid, region.elementUuid, region.intent])).toEqual([
      [f.page.uuid, f.root.uuid, purpose.purpose], [second.uuid, secondRoot.uuid, purpose.purpose],
    ]);
  });
  it("covers all inserted sibling roots and deduplicates repeated operations", async () => {
    const f = fixture(); const first = customRegion(); const second = customRegion();
    runInAction(() => { f.page.tplTree = mkTplTagX("div", {}, [first, second]); });
    const receipt = { name: "insertHtml", componentUuid: f.page.uuid, created: [first, second].map(node => ({ kind: "Element", uuid: node.uuid, componentUuid: f.page.uuid })) };
    await reviewComponents(f.studioCtx, [...f.operations, ...f.operations], [receipt, receipt], purpose);
    expect(f.review).toHaveBeenCalledOnce();
    expect(f.review.mock.calls[0][0].regions.map((region: any) => region.elementUuid)).toEqual([first.uuid, second.uuid]);
  });
  it("reports partial coverage when actual changed scopes exceed the five-region budget", async () => {
    const f = fixture(); const roots = Array.from({ length: 6 }, customRegion);
    runInAction(() => { f.page.tplTree = mkTplTagX("div", {}, roots); });
    const result = await reviewComponents(f.studioCtx, f.operations, [{ name: "insertHtml", componentUuid: f.page.uuid, created: roots.map(node => ({ kind: "Element", uuid: node.uuid, componentUuid: f.page.uuid })) }], purpose);
    expect(f.review.mock.calls[0][0].regions).toHaveLength(5);
    expect(result.status).toBe("partial");
  });
  it("times out the entire check, including cache sync, and never starts a late query", async () => {
    const f = fixture(); let release: () => void = () => {};
    f.sync.mockImplementation(() => new Promise<void>(resolve => { release = resolve; }));
    vi.useFakeTimers();
    try {
      const pending = reviewComponents(f.studioCtx, f.operations, f.receipts, purpose);
      await vi.advanceTimersByTimeAsync(5001);
      expect((await pending).status).toBe("timeout");
      release(); await Promise.resolve(); expect(f.review).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it("includes the cross-frame availability probe in the total deadline", async () => {
    const f = fixture();
    vi.mocked(f.api.componentReuse).mockImplementation(async request => request.command === "status" ? new Promise(() => {}) : undefined);
    vi.useFakeTimers();
    try {
      const pending = reviewComponents(f.studioCtx, f.operations, f.receipts, purpose);
      await vi.advanceTimersByTimeAsync(5001);
      expect((await pending).status).toBe("timeout");
      expect(f.review).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it("keeps a committed native edit successful when advisory preparation fails", async () => {
    const f = fixture(); f.sync.mockRejectedValue(new Error("Index unavailable"));
    const { studioCtx } = fakeStudioCtx({ devFlagOverrides: { enableComponentReuseAdvisory: true } });
    f.wire(studioCtx);
    const created = JSON.parse(await COPILOT_TOOLS.createComponent.execute(studioCtx, { name: "Confirm", type: "page", path: "/confirm", reviewContext: { purpose: "创建确认页面" } }));
    const output = JSON.parse(await COPILOT_TOOLS.insertHtml.execute(studioCtx, {
      componentUuid: created.created[0].uuid, html: "<button>确认</button>",
      reviewContext: { purpose: "确认当前业务操作。点击确认；提交当前操作" },
    }));
    expect(output.created).toHaveLength(1); expect(output.componentReview.status).toBe("unavailable");
    expect(studioCtx.copilotActivity.store.getState().requests.at(-1)?.status).toBe("success");
  });
  it("keeps the same atomic batch scan open through review and closes it once", async () => {
    const f = fixture(); const { studioCtx } = fakeStudioCtx({ devFlagOverrides: { enableComponentReuseAdvisory: true } });
    f.wire(studioCtx);
    const page = JSON.parse(await COPILOT_TOOLS.createComponent.execute(studioCtx, { name: "Actions", type: "page", path: "/actions", reviewContext: { purpose: "Create an actions page" } }));
    let complete: (result: unknown) => void = () => {};
    f.review.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const begin = vi.spyOn(studioCtx.copilotActivity, "begin");
    const pending = COPILOT_TOOLS.executeBatch.execute(studioCtx, {
      operations: ["Confirm", "Reset"].map(label => ({ name: "insertHtml", input: { componentUuid: page.created[0].uuid, html: `<button>${label}</button>` } })),
      reviewContext: { purpose: "Confirm or reset the current operation。Click Confirm or Reset；Submit or reset the current values" },
    });
    await vi.waitFor(() => expect(f.review).toHaveBeenCalledOnce());
    const activity = studioCtx.copilotActivity.store.getState().requests.at(-1);
    expect(activity?.status).toBe("running"); expect(activity?.scanning).toBe(true); expect(begin).toHaveBeenCalledOnce();
    complete({ status: "completed", indexed: 1, total: 1, elapsedMs: 25, suggestions: [] });
    const result = JSON.parse(await pending);
    expect(result.operations).toHaveLength(2); expect(result.componentReview.status).toBe("completed");
    expect(studioCtx.copilotActivity.store.getState().requests.at(-1)?.id).toBe(activity?.id);
    expect(studioCtx.copilotActivity.store.getState().requests.at(-1)?.status).toBe("success");
  });
});

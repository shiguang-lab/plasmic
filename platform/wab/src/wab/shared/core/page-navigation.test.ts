import { mkVariant, mkVariantSetting } from "@/wab/shared/Variants";
import { mkParam } from "@/wab/shared/core/lang";
import { typeFactory } from "@/wab/shared/model/model-util";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { code, codeLit, InteractionConditionalMode } from "@/wab/shared/core/exprs";
import { collectPageNavigations, resolveNavigationTarget } from "@/wab/shared/core/page-navigation";
import { createSite } from "@/wab/shared/core/sites";
import { mkInteraction } from "@/wab/shared/core/states";
import { ensure } from "@/wab/shared/common";
import { Arg, CollectionExpr, FunctionExpr, MapExpr, EventHandler, PageHref, TemplatedString, ensureKnownTplTag } from "@/wab/shared/model/classes";

function fixture() {
  const site = createSite(), mgr = new TplMgr({ site });
  const page = mgr.addComponent({ name: "List", type: ComponentType.Page });
  const detail = mgr.addComponent({ name: "Detail", type: ComponentType.Page });
  ensure(detail.pageMeta, "Detail page metadata").path = "/orders/[id]";
  const tpl = ensureKnownTplTag(page.tplTree);
  const read = () => collectPageNavigations(page, [page, detail], (node) => node.vsettings);
  return { page, detail, tpl, read };
}

it("resolves explicit page identities and static paths without executing dynamic code", () => {
  const { page, detail } = fixture();
  const pages = [page, detail];
  expect(resolveNavigationTarget(new PageHref({ page: detail, params: {}, query: {}, fragment: null, encode: true }), pages).target).toBe(detail);
  expect(resolveNavigationTarget(codeLit("/orders/42?tab=items"), pages).target).toBe(detail);
  expect(resolveNavigationTarget(new TemplatedString({ text: ["/orders/42?id=", code("$state.id")] }), pages).target).toBe(detail);
  expect(resolveNavigationTarget(code("window.location.href"), pages)).toEqual({ kind: "dynamic" });
  expect(resolveNavigationTarget(codeLit("https://example.com/orders/42"), pages)).toEqual({ kind: "external" });
  expect(resolveNavigationTarget(codeLit("#summary"), pages)).toEqual({ kind: "anchor" });
});

it("removes only a conditional navigation action, preserving its event and other steps", () => {
  const { tpl, read } = fixture();
  const handler = new EventHandler({ interactions: [] });
  const save = mkInteraction(handler, "customFunction", "Save", {});
  const navigate = mkInteraction(handler, "navigation", "Open", { destination: codeLit("/orders/42") });
  navigate.conditionalMode = InteractionConditionalMode.Expression;
  navigate.condExpr = code("$state.saved");
  handler.interactions.push(save, navigate);
  tpl.vsettings[0].attrs.onFinish = handler;
  const [link] = read();
  expect(link.event).toBe("onFinish");
  expect(link.conditional).toBe(true);
  link.remove();
  expect(handler.interactions).toEqual([save]);
  expect(tpl.vsettings[0].attrs.onFinish).toBe(handler);
  expect(read()).toEqual([]);
});

it("suppresses disabled actions and replaces a removed href without revealing an inherited link", () => {
  const { tpl, detail, read } = fixture();
  tpl.vsettings[0].attrs.href = new PageHref({ page: detail, params: {}, query: {}, fragment: null, encode: true });
  const handler = new EventHandler({ interactions: [] });
  const disabled = mkInteraction(handler, "navigation", "Disabled", { destination: codeLit("/orders/42") });
  disabled.conditionalMode = InteractionConditionalMode.Never;
  handler.interactions.push(disabled); tpl.vsettings[0].attrs.onClick = handler;
  const links = read();
  expect(links).toHaveLength(1);
  links[0].remove();
  expect(read()).toEqual([]);
  expect(handler.interactions).toEqual([disabled]);
  tpl.vsettings[0].attrs.href = codeLit(null);
  expect(read()).toEqual([]);
});

function navigationHandler() {
  const handler = new EventHandler({ interactions: [] });
  handler.interactions.push(mkInteraction(handler, "navigation", "Open", { destination: codeLit("/orders/42") }));
  return handler;
}

it("clears the event binding after removing its last action", () => {
  const { tpl, read } = fixture();
  tpl.vsettings[0].attrs.onClick = navigationHandler();
  read()[0].remove();
  expect(tpl.vsettings[0].attrs.onClick).toBeUndefined();
  expect(read()).toEqual([]);
});

it("clears component argument handlers and retains other arguments", () => {
  const { tpl, read } = fixture();
  const event = new Arg({ param: mkParam({ name: "onFinish", type: typeFactory.func(), paramType: "prop" }), expr: navigationHandler() });
  const label = new Arg({ param: mkParam({ name: "label", type: typeFactory.text(), paramType: "prop" }), expr: codeLit("Submit") });
  tpl.vsettings[0].args.push(event, label);
  read()[0].remove();
  expect(tpl.vsettings[0].args).toEqual([label]);
  expect(read()).toEqual([]);
});

it("does not reveal a base event after clearing an active variant's event", () => {
  const { tpl, read } = fixture();
  const base = navigationHandler();
  tpl.vsettings[0].attrs.onClick = base;
  const variant = mkVariantSetting({ variants: [mkVariant({ name: "Active" })], attrs: { onClick: navigationHandler() } });
  tpl.vsettings.push(variant);
  read()[0].remove();
  expect(read()).toEqual([]);
  expect(tpl.vsettings[0].attrs.onClick).toBe(base);
  expect(base.interactions).toHaveLength(1);
});

it("clears nested handlers without deleting their containing data", () => {
  const { tpl, read } = fixture();
  const label = codeLit("Open");
  const item = new MapExpr({ mapExpr: { onClick: navigationHandler(), label } });
  const callback = new FunctionExpr({ argNames: [], bodyExpr: navigationHandler() });
  const list = new CollectionExpr({ exprs: [item, callback] });
  tpl.vsettings[0].attrs.items = list;
  read().forEach((link) => link.remove());
  expect(item.mapExpr.onClick).toBeUndefined();
  expect(item.mapExpr.label).toBe(label);
  expect(list.exprs).toHaveLength(2);
  expect(read()).toEqual([]);
});

it("resolves parameterized TemplatedString and CustomCode route concatenations without executing code", () => {
  const site = createSite(), mgr = new TplMgr({ site });
  const mobileList = mgr.addComponent({ name: "MobileList", type: ComponentType.Page });
  ensure(mobileList.pageMeta, "MobileList pageMeta").path = "/m/work-orders";
  const mobileDetail = mgr.addComponent({ name: "MobileDetail", type: ComponentType.Page });
  ensure(mobileDetail.pageMeta, "MobileDetail pageMeta").path = "/m/work-orders/detail/[id]/[mode]";
  const instances = mgr.addComponent({ name: "Instances", type: ComponentType.Page });
  ensure(instances.pageMeta, "Instances pageMeta").path = "/bpm/instances";
  const pages = [mobileList, mobileDetail, instances];

  expect(resolveNavigationTarget(
    new TemplatedString({ text: ["/m/work-orders/detail/", code("item.id"), "/", code("mode")] }),
    pages,
  )).toEqual({ kind: "page", target: mobileDetail });

  expect(resolveNavigationTarget(
    code('"/m/work-orders/detail/" + currentItem.id + "/" + ($state.activeTab === "pending" ? "handle" : "view")'),
    pages,
  )).toEqual({ kind: "page", target: mobileDetail });

  expect(resolveNavigationTarget(
    code("`/m/work-orders/detail/${currentItem.id}/${mode}`"),
    pages,
  )).toEqual({ kind: "page", target: mobileDetail });

  expect(resolveNavigationTarget(
    code('"/m/work-orders/detail/" + rest'),
    pages,
  )).toEqual({ kind: "page", target: mobileDetail });

  expect(resolveNavigationTarget(
    code('"/bpm/instances?status=RUNNING" + ($state.selectedFlow ? "&flow=" + $state.selectedFlow : "")'),
    pages,
  )).toEqual({ kind: "page", target: instances });

  expect(resolveNavigationTarget(code('"/m/" + section'), pages)).toEqual({ kind: "dynamic" });
  expect(resolveNavigationTarget(code('$ctx.params?.mode === "admin" ? "/bpm/instances" : "/m/work-orders"'), pages)).toEqual({ kind: "dynamic" });
  expect(resolveNavigationTarget(code('"https://example.com/" + slug'), pages)).toEqual({ kind: "external" });
  expect(resolveNavigationTarget(code('"#step-" + index'), pages)).toEqual({ kind: "anchor" });
});
